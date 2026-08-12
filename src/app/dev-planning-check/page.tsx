'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import NewSchedulePlanner from '@/components/schedule/NewSchedulePlanner';

const mk = (teacher: string, day: string, s: string, e: string, notes = '') => {
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  return {
    id: `${teacher}${day}${s}`,
    title: `Lektion ${teacher}`,
    teacher,
    room: 'A12',
    notes,
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
  // Den enda posten med anteckningar från början — källan när "kopiera
  // anteckningar" och gummibandsmarkeringen ska provas.
  mk('Tobias', 'Måndag', '08:00', '09:30', 'Prov kap 4'),
  mk('Tobias', 'Måndag', '11:00', '12:00'),
  mk('Hanna', 'Måndag', '14:00', '15:00'),
  mk('Hanna', 'Tisdag', '09:00', '10:00'),
  mk('Tobias', 'Tisdag', '10:00', '10:30'),
  mk('Tobias', 'Tisdag', '10:45', '14:00'),
  mk('Hanna', 'Onsdag', '08:00', '16:00'),
  mk('Hanna', 'Torsdag', '08:00', '16:00'),
  mk('Hanna', 'Fredag', '08:00', '12:00')
];

/** Eget schema, delat vidare till en kollega. */
const OWN_ARCHIVE = {
  id: 'arch-egen',
  name: 'v.35',
  ownerId: 'u-tobias',
  ownerUsername: 'tobias',
  isOwner: true,
  sharedWith: ['hanna'],
  lock: { userId: 'u-tobias', username: 'tobias', acquiredAt: null, isMine: true },
  updatedAt: null
};

/**
 * Kollegans schema, delat hit — och hon sitter i det. Öppna det i listan för
 * att se läsläget: bannern i verktygsfältet, och att korten inte går att dra.
 */
const SHARED_ARCHIVE = {
  id: 'arch-hannas',
  name: 'v.36',
  ownerId: 'u-hanna',
  ownerUsername: 'hanna',
  isOwner: false,
  sharedWith: ['tobias'],
  lock: { userId: 'u-hanna', username: 'hanna', acquiredAt: null, isMine: false },
  updatedAt: null
};

/**
 * Stubbar backend så planeraren går att titta på utan inloggning.
 *
 * Ingen token sätts: `fetchWithAuth` lägger bara till en Authorization-header
 * om det finns en, och omdirigeringen till /login kommer från dess
 * 401-hantering. Med fetch stubbad till 200 behövs ingen token – och `authToken`
 * är nyckeln `AuthContext` läser, så en påhittad token här hade fått den
 * riktiga appen att tro att du var inloggad i samma webbläsare.
 *
 * Följden av att inte vara inloggad: `useAuth().user` är null, så knappen
 * "Lämna schemat" i delningsrutan ritas inte här. Den kräver den riktiga appen.
 */
const installStub = () => {
  if (typeof window === 'undefined') return true;
  localStorage.setItem('app.teachers.v1', JSON.stringify(['Tobias Lundh', 'Hanna Berg']));
  localStorage.setItem(
    'app.teacher_availability.v1',
    JSON.stringify({ 'Tobias Lundh': { 'Fredag': ['all'], 'Torsdag': ['fm'] } })
  );
  // Med bara det gamla namnet satt provas även övergången till id-nyckeln.
  localStorage.removeItem('active_archive_id');
  localStorage.setItem('active_archive_name', 'v.35');

  const json = (data: unknown) => new Response(
    JSON.stringify({ success: true, data, error: null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

  const archiveOf = (url: string) => (
    url.includes(SHARED_ARCHIVE.id) ? SHARED_ARCHIVE : OWN_ARCHIVE
  );

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url ?? input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/lock')) {
      const archive = archiveOf(url);
      if (method === 'DELETE') {
        archive.lock = null as never;
        return json({ message: 'Released' });
      }
      // Hannas schema är låst från början, så läsläget går att titta på. Ett
      // medvetet övertagande (force) släpps igenom, precis som i backend.
      const held = Boolean(archive.lock) && !archive.lock.isMine;
      const force = Boolean(init?.body && String(init.body).includes('"force":true'));
      if (held && !force) return json({ acquired: false, archive });
      archive.lock = { userId: 'u-tobias', username: 'tobias', acquiredAt: null, isMine: true };
      return json({ acquired: true, archive });
    }
    if (url.includes('/planner/archives/')) {
      if (method === 'PUT') return json({ archive: archiveOf(url), count: ACTIVITIES.length, activities: ACTIVITIES });
      return json({ archive: archiveOf(url), activities: ACTIVITIES });
    }
    if (url.includes('/planner/archives')) return json([OWN_ARCHIVE, SHARED_ARCHIVE]);
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
