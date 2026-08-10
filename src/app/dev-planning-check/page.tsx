'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import NewSchedulePlanner from '@/components/schedule/NewSchedulePlanner';

const mk = (teacher: string, day: string, s: string, e: string) => {
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  return {
    id: `${teacher}${day}${s}`,
    title: `Lektion ${teacher}`,
    teacher,
    room: 'A12',
    notes: '',
    day,
    startTime: s,
    endTime: e,
    duration: (eh * 60 + em) - (sh * 60 + sm),
    color: '#bae6fd',
    category: ''
  };
};

/** Lunchen ligger som en egen post utan lärare, precis som i det riktiga schemat. */
const lunch = (day: string) => ({ ...mk('', day, '11:30', '12:15'), title: 'Lunch' });

/** ATP gäller hela kollegiet – "alla" under lärare. */
const atp = { ...mk('alla', 'Onsdag', '14:00', '15:00'), title: 'ATP' };

/** Personalpost som ska gå att utesluta ur en export. */
const akMote = { ...mk('Hanna', 'Torsdag', '15:00', '16:00'), title: 'AK MÖTE' };

const ACTIVITIES = [
  lunch('Måndag'),
  lunch('Onsdag'),
  atp,
  akMote,
  mk('Tobias', 'Måndag', '08:00', '09:30'),
  mk('Tobias', 'Måndag', '11:00', '12:00'),
  mk('Hanna', 'Måndag', '14:00', '15:00'),
  mk('Hanna', 'Tisdag', '09:00', '10:00'),
  mk('Tobias', 'Tisdag', '10:00', '10:30'),
  mk('Tobias', 'Tisdag', '10:45', '14:00'),
  mk('Hanna', 'Onsdag', '08:00', '16:00'),
  mk('Hanna', 'Torsdag', '08:00', '16:00'),
  mk('Hanna', 'Fredag', '08:00', '12:00')
];

/**
 * Stubbar backend så planeraren går att titta på utan inloggning.
 *
 * Ingen token sätts: `fetchWithAuth` lägger bara till en Authorization-header
 * om det finns en, och omdirigeringen till /login kommer från dess
 * 401-hantering. Med fetch stubbad till 200 behövs ingen token – och `authToken`
 * är nyckeln `AuthContext` läser, så en påhittad token här hade fått den
 * riktiga appen att tro att du var inloggad i samma webbläsare.
 */
const installStub = () => {
  if (typeof window === 'undefined') return true;
  localStorage.setItem('app.teachers.v1', JSON.stringify(['Tobias Lundh', 'Hanna Berg']));
  localStorage.setItem(
    'app.teacher_availability.v1',
    JSON.stringify({ 'Tobias Lundh': { 'Fredag': ['all'], 'Torsdag': ['fm'] } })
  );
  localStorage.setItem('active_archive_name', 'v.35');

  const json = (data: unknown) => new Response(
    JSON.stringify({ success: true, data, error: null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

  window.fetch = async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url ?? input);
    if (url.includes('/planner/archives')) return json(['v.35']);
    if (url.includes('/planner/activities')) return json(ACTIVITIES);
    return json([]);
  };
  return true;
};

/**
 * Stubben installeras via `useState` och inte `useEffect`: den lazy
 * initializern kör under första renderingen, alltså innan planerarens effekter
 * hinner anropa backenden.
 */
function StubbedPlanner() {
  useState(installStub);
  return <NewSchedulePlanner />;
}

export default function DevPlanningCheck() {
  // Routen finns bara lokalt. I produktion svarar den 404 i stället för att
  // ligga öppen på Vercel. NODE_ENV bakas in vid bygget, så grinden är statisk.
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <StubbedPlanner />;
}
