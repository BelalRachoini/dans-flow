import type { User, Course, ClassSession, Event, TicketType, Ticket, Membership, Subscription, Invoice, PointsTransaction } from '@/types';

export const seedUsers: User[] = [
  {
    id: 'user-1',
    name: 'Anna Andersson',
    email: 'anna@example.com',
    phone: '+46701234567',
    role: 'ADMIN',
    avatarUrl: '',
    createdAt: '2024-01-15T10:00:00Z',
    pointsBalance: 50,
    memberships: [],
  },
  {
    id: 'user-2',
    name: 'Erik Svensson',
    email: 'erik@example.com',
    phone: '+46709876543',
    role: 'INSTRUKTOR',
    avatarUrl: '',
    createdAt: '2024-02-01T10:00:00Z',
    pointsBalance: 20,
    memberships: [],
  },
  {
    id: 'user-3',
    name: 'Maria Johansson',
    email: 'maria@example.com',
    phone: '+46705555555',
    role: 'MEDLEM',
    avatarUrl: '',
    createdAt: '2024-03-10T10:00:00Z',
    pointsBalance: 12,
    memberships: [],
  },
  {
    id: 'user-4',
    name: 'Lars Nilsson',
    email: 'lars@example.com',
    role: 'MEDLEM',
    avatarUrl: '',
    createdAt: '2024-03-15T10:00:00Z',
    pointsBalance: 8,
    memberships: [],
  },
];

export const seedCourses: Course[] = [
  {
    id: 'course-1',
    title: 'Salsa Nybörjare',
    style: 'Salsa',
    totalLessons: 12,
    startDate: '2025-01-15',
    endDate: '2025-04-15',
    dayOfWeek: 3, // Wednesday
    time: '18:00',
    location: 'Studio A',
    description: 'Perfekt för dig som är helt ny inom Salsa. Vi går igenom grundsteg och enkel partnerdans.',
    instructorId: 'user-2',
    priceSEK: 2400,
  },
  {
    id: 'course-2',
    title: 'Bachata Mellanivå',
    style: 'Bachata',
    totalLessons: 12,
    startDate: '2025-01-16',
    endDate: '2025-04-16',
    dayOfWeek: 4, // Thursday
    time: '19:00',
    location: 'Studio B',
    description: 'För dig som kan grunderna och vill utvecklas vidare. Vi fokuserar på leads, follows och musikalitet.',
    instructorId: 'user-2',
    priceSEK: 2400,
  },
  {
    id: 'course-3',
    title: 'Kizomba Grund',
    style: 'Kizomba',
    totalLessons: 12,
    startDate: '2025-01-14',
    endDate: '2025-04-14',
    dayOfWeek: 2, // Tuesday
    time: '20:00',
    location: 'Studio A',
    description: 'Upptäck Kizombans sensuella och flytande rörelser. Grundkurs för alla nivåer.',
    instructorId: 'user-2',
    priceSEK: 2400,
  },
  {
    id: 'course-4',
    title: 'HipHop för Ungdomar',
    style: 'HipHop',
    totalLessons: 12,
    startDate: '2025-01-17',
    endDate: '2025-04-17',
    dayOfWeek: 5, // Friday
    time: '17:00',
    location: 'Studio C',
    description: 'Energifylld HipHop-kurs för ungdomar. Lär dig senaste moves och hitta din egen stil.',
    instructorId: 'user-2',
    priceSEK: 1800,
  },
];

export const seedSessions: ClassSession[] = [
  {
    id: 'session-1',
    courseId: 'course-1',
    date: '2025-01-15',
    startTime: '18:00',
    endTime: '19:30',
    location: 'Studio A',
    instructorId: 'user-2',
    attendees: ['user-3', 'user-4'],
  },
  {
    id: 'session-2',
    courseId: 'course-2',
    date: '2025-01-16',
    startTime: '19:00',
    endTime: '20:30',
    location: 'Studio B',
    instructorId: 'user-2',
    attendees: ['user-3'],
  },
];

export const seedEvents: Event[] = [
  {
    id: 'event-1',
    title: 'Salsa Social - Vinterspecial',
    description: 'Kom och dansa hela kvällen! Workshops kl 19:00, social dance från 20:30. DJ och levande musik.',
    date: '2025-02-14',
    time: '19:00',
    location: 'Stora salen',
  },
  {
    id: 'event-2',
    title: 'Bachata Festival Stockholm',
    description: 'Tre dagar med internationella instruktörer, shows och socialdans. Det största Bachata-eventet i Norden!',
    date: '2025-03-21',
    time: '10:00',
    location: 'Stockholm Waterfront',
  },
  {
    id: 'event-3',
    title: 'Kizomba Night',
    description: 'En kväll dedikerad till Kizomba och Urbankiz. Workshop kl 20:00, fri dans från 21:30.',
    date: '2025-02-28',
    time: '20:00',
    location: 'Studio A & B',
  },
];

export const seedTicketTypes: TicketType[] = [
  {
    id: 'ticket-type-1',
    eventId: 'event-1',
    name: 'Allmän',
    priceSEK: 250,
    stock: 50,
  },
  {
    id: 'ticket-type-2',
    eventId: 'event-1',
    name: 'VIP',
    priceSEK: 450,
    stock: 20,
  },
  {
    id: 'ticket-type-3',
    eventId: 'event-2',
    name: 'Helgpass',
    priceSEK: 1200,
    stock: 100,
  },
  {
    id: 'ticket-type-4',
    eventId: 'event-2',
    name: 'VIP Helgpass',
    priceSEK: 2000,
    stock: 30,
  },
  {
    id: 'ticket-type-5',
    eventId: 'event-3',
    name: 'Allmän',
    priceSEK: 200,
    stock: 40,
  },
];

export const seedTickets: Ticket[] = [
  {
    id: 'ticket-1',
    eventId: 'event-1',
    userId: 'user-3',
    typeId: 'ticket-type-1',
    qrCode: 'QR-EVENT1-USER3-001',
    issuedAt: '2025-01-10T14:30:00Z',
    used: false,
  },
];

export const seedMemberships: Membership[] = [
  {
    id: 'membership-1',
    name: 'Basic',
    priceSEK: 299,
    interval: 'month',
    benefits: ['10% rabatt på kurser', 'Gratis drop-in 1 gång/månad'],
    status: 'active',
  },
  {
    id: 'membership-2',
    name: 'Premium',
    priceSEK: 599,
    interval: 'month',
    benefits: ['20% rabatt på kurser', 'Gratis drop-in obegränsat', 'Förtur till event', 'VIP-tillträde till socialdanser'],
    status: 'active',
  },
  {
    id: 'membership-3',
    name: 'Årskort',
    priceSEK: 5990,
    interval: 'year',
    benefits: ['25% rabatt på kurser', 'Gratis drop-in obegränsat', 'Förtur till event', 'VIP-tillträde', 'Gratis workshops 1 gång/månad'],
    status: 'active',
  },
];

export const seedSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    userId: 'user-3',
    membershipId: 'membership-1',
    status: 'active',
    currentPeriodEnd: '2025-02-10',
    startDate: '2024-03-10',
  },
];

export const seedInvoices: Invoice[] = [
  {
    id: 'inv-1',
    userId: 'user-3',
    amountSEK: 2400,
    createdAt: '2025-01-05T10:00:00Z',
    paid: true,
    description: 'Salsa Nybörjare - 12 lektioner',
  },
  {
    id: 'inv-2',
    userId: 'user-3',
    amountSEK: 299,
    createdAt: '2025-01-10T10:00:00Z',
    paid: true,
    description: 'Basic Medlemskap - Januari 2025',
  },
  {
    id: 'inv-3',
    userId: 'user-4',
    amountSEK: 1800,
    createdAt: '2025-01-08T10:00:00Z',
    paid: true,
    description: 'HipHop för Ungdomar - 12 lektioner',
  },
];

export const seedPointsTransactions: PointsTransaction[] = [
  {
    id: 'pt-1',
    userId: 'user-3',
    amount: 12,
    type: 'purchase',
    description: 'Köpt kurs: Salsa Nybörjare',
    createdAt: '2025-01-05T10:00:00Z',
    relatedId: 'course-1',
  },
  {
    id: 'pt-2',
    userId: 'user-3',
    amount: -1,
    type: 'usage',
    description: 'Närvaro: Salsa Nybörjare',
    createdAt: '2025-01-15T18:00:00Z',
    relatedId: 'session-1',
  },
  {
    id: 'pt-3',
    userId: 'user-4',
    amount: 12,
    type: 'purchase',
    description: 'Köpt kurs: HipHop för Ungdomar',
    createdAt: '2025-01-08T10:00:00Z',
    relatedId: 'course-4',
  },
  {
    id: 'pt-4',
    userId: 'user-4',
    amount: -1,
    type: 'usage',
    description: 'Närvaro: HipHop för Ungdomar',
    createdAt: '2025-01-17T17:00:00Z',
    relatedId: 'session-1',
  },
];
