import { AttendanceTable, parseAttendance } from '@/utils/narvaro';

/**
 * Exempel som visas innan något ark har klistrats in. Namnen är påhittade.
 * Riktiga elevnamn ska aldrig in i koden; de finns bara i webbläsaren.
 */
const HEAD = [
  ['', 'Måndag', '', '', 'Tisdag', '', '', 'Onsdag', '', '', 'Torsdag', '', '', '', 'Fredag', '', ''],
  ['', '8.30-9.45', '10.00-11.30', '12.30-14.00', 'Studieverkstad', '12.30-14.30', 'Studieverkstad',
    '8.30-9.45', '10.00-11.30', '12.30-14.30', '8.30-10.00', '10.15-11.45', '12.30-14.30', 'Studieverkstad',
    'Studieverkstad', '9.45-11.30', '12.30-14.30'],
];
const CLASS_A = ['Amira Haddad', 'Bilal Noor', 'Dana Yousef', 'Elif Kaya', 'Farid Rahimi', 'Greta Lind',
  'Hamza Said', 'Ines Moreno', 'Jonas Berg', 'Karin Holm', 'Layla Aziz'];
const CLASS_B = ['Mats Ek', 'Nour Saleh', 'Omar Diallo', 'Petra Nyström', 'Rania Khalil', 'Samir Osman',
  'Tea Kovač', 'Ulla Sjö', 'Viktor Hed', 'Yara Mansour', 'Zeynep Arslan'];

export function exampleTable(): AttendanceTable {
  // Fast frö, så att exemplet ser likadant ut varje gång.
  let seed = 7;
  const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const grid = HEAD.map(r => [...r]);
  const add = (group: string, names: string[]) => {
    grid.push([group]);
    names.forEach(n => grid.push([n, ...Array.from({ length: 16 }, (_, i) => (i < 8 && random() < 0.78 ? 'TRUE' : 'FALSE'))]));
  };
  add('KLASS A', CLASS_A);
  add('KLASS B', CLASS_B);
  const table = parseAttendance(grid);
  if (!table) throw new Error('Exemplet gick inte att läsa');
  return table;
}
