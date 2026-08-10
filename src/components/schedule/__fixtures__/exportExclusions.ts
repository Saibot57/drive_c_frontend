export type ExcludeParseFixture = {
  name: string;
  input: string;
  expected: string[];
};

export const excludeParseFixtures: ExcludeParseFixture[] = [
  {
    name: 'Semikolon är den skrivna separatorn',
    input: 'ATP; AK MÖTE',
    expected: ['ATP', 'AK MÖTE']
  },
  {
    name: 'Radbrytningar duger också',
    input: 'ATP\nAK MÖTE',
    expected: ['ATP', 'AK MÖTE']
  },
  {
    name: 'Tomma delar och extra blanksteg försvinner',
    input: '  ATP ;; \n  ; AK MÖTE  \n',
    expected: ['ATP', 'AK MÖTE']
  },
  {
    name: 'Dubbletter med olika versaler räknas en gång',
    input: 'ATP; atp; ATp',
    expected: ['ATP']
  },
  {
    name: 'Tom text ger tom lista',
    input: '   \n  ',
    expected: []
  }
];

export type ExcludeMatchFixture = {
  name: string;
  title: string;
  patterns: string[];
  expected: boolean;
};

export const excludeMatchFixtures: ExcludeMatchFixture[] = [
  {
    name: 'Exakt titel träffar',
    title: 'ATP',
    patterns: ['ATP'],
    expected: true
  },
  {
    name: 'Skiftläge spelar ingen roll',
    title: 'ak möte',
    patterns: ['AK MÖTE'],
    expected: true
  },
  {
    name: 'Blanksteg runt titeln spelar ingen roll',
    title: '  ATP  ',
    patterns: ['ATP'],
    expected: true
  },
  {
    name: 'Delsträng träffar inte utan jokertecken',
    title: 'ATP-möte',
    patterns: ['ATP'],
    expected: false
  },
  {
    name: 'Jokertecken tar allt som börjar med mönstret',
    title: 'AK-planering',
    patterns: ['AK*'],
    expected: true
  },
  {
    name: 'Jokertecken mitt i fungerar',
    title: 'AK möte tisdag',
    patterns: ['AK*tisdag'],
    expected: true
  },
  {
    name: 'Ett av flera mönster räcker',
    title: 'AK MÖTE',
    patterns: ['ATP', 'AK MÖTE'],
    expected: true
  },
  {
    name: 'Tom lista utesluter ingenting',
    title: 'ATP',
    patterns: [],
    expected: false
  },
  {
    name: 'Post utan titel utesluts inte',
    title: '',
    patterns: ['ATP'],
    expected: false
  },
  {
    name: 'Regexptecken i titeln tolkas som text',
    title: 'Prov (kap 3)',
    patterns: ['Prov (kap 3)'],
    expected: true
  }
];
