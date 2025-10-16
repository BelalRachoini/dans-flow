import {
  seedUsers, seedCourses, seedSessions, seedEvents, seedTicketTypes,
  seedTickets, seedMemberships, seedSubscriptions, seedInvoices, seedPointsTransactions
} from '@/data/seed';
import type {
  User, Course, ClassSession, Event, TicketType, Ticket, Membership,
  Subscription, Invoice, PointsTransaction, CartItem
} from '@/types';

// Simulated delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory storage (simulated database)
let users = [...seedUsers];
let courses = [...seedCourses];
let sessions = [...seedSessions];
let events = [...seedEvents];
let ticketTypes = [...seedTicketTypes];
let tickets = [...seedTickets];
let memberships = [...seedMemberships];
let subscriptions = [...seedSubscriptions];
let invoices = [...seedInvoices];
let pointsTransactions = [...seedPointsTransactions];

// Auth
export const mockLogin = async (email: string, password: string): Promise<User> => {
  await delay();
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('Användare hittades inte');
  return user;
};

export const mockRegister = async (data: { name: string; email: string; password: string; phone?: string }): Promise<User> => {
  await delay();
  const newUser: User = {
    id: `user-${Date.now()}`,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: 'MEDLEM',
    createdAt: new Date().toISOString(),
    pointsBalance: 0,
    memberships: [],
  };
  users.push(newUser);
  return newUser;
};

// Users
export const listUsers = async (): Promise<User[]> => {
  await delay();
  return users;
};

export const getUser = async (id: string): Promise<User | undefined> => {
  await delay();
  return users.find(u => u.id === id);
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
  await delay();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('Användare hittades inte');
  users[index] = { ...users[index], ...data };
  return users[index];
};

export const adjustPoints = async (userId: string, delta: number, description: string): Promise<User> => {
  await delay();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('Användare hittades inte');
  
  user.pointsBalance += delta;
  
  const transaction: PointsTransaction = {
    id: `pt-${Date.now()}`,
    userId,
    amount: delta,
    type: delta > 0 ? 'purchase' : 'usage',
    description,
    createdAt: new Date().toISOString(),
  };
  pointsTransactions.push(transaction);
  
  return user;
};

// Courses
export const listCourses = async (): Promise<Course[]> => {
  await delay();
  return courses;
};

export const getCourse = async (id: string): Promise<Course | undefined> => {
  await delay();
  return courses.find(c => c.id === id);
};

export const createCourse = async (data: Omit<Course, 'id'>): Promise<Course> => {
  await delay();
  const newCourse: Course = {
    ...data,
    id: `course-${Date.now()}`,
  };
  courses.push(newCourse);
  return newCourse;
};

// Sessions
export const listSessionsByCourse = async (courseId: string): Promise<ClassSession[]> => {
  await delay();
  return sessions.filter(s => s.courseId === courseId);
};

export const checkInToSession = async (userId: string, sessionId: string): Promise<void> => {
  await delay();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error('Session hittades inte');
  
  if (!session.attendees) session.attendees = [];
  if (!session.attendees.includes(userId)) {
    session.attendees.push(userId);
    await adjustPoints(userId, -1, `Närvaro: Session ${sessionId}`);
  }
};

// Events
export const listEvents = async (): Promise<Event[]> => {
  await delay();
  return events;
};

export const getEvent = async (id: string): Promise<Event | undefined> => {
  await delay();
  return events.find(e => e.id === id);
};

export const createEvent = async (data: Omit<Event, 'id'>): Promise<Event> => {
  await delay();
  const newEvent: Event = {
    ...data,
    id: `event-${Date.now()}`,
  };
  events.push(newEvent);
  return newEvent;
};

export const updateEvent = async (id: string, data: Partial<Event>): Promise<Event> => {
  await delay();
  const index = events.findIndex(e => e.id === id);
  if (index === -1) throw new Error('Event hittades inte');
  events[index] = { ...events[index], ...data };
  return events[index];
};

export const deleteEvent = async (id: string): Promise<void> => {
  await delay();
  events = events.filter(e => e.id !== id);
};

// Ticket Types
export const listTicketTypes = async (eventId: string): Promise<TicketType[]> => {
  await delay();
  return ticketTypes.filter(tt => tt.eventId === eventId);
};

// Tickets
export const purchaseTickets = async (items: CartItem[], userId: string): Promise<Ticket[]> => {
  await delay(600);
  
  const newTickets: Ticket[] = items
    .filter(item => item.type === 'ticket')
    .map(item => ({
      id: `ticket-${Date.now()}-${Math.random()}`,
      eventId: item.itemId.split('-')[0], // simplified
      userId,
      typeId: item.itemId,
      qrCode: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      used: false,
    }));
  
  tickets.push(...newTickets);
  
  // Create invoice
  const total = items.reduce((sum, item) => sum + item.priceSEK * item.quantity, 0);
  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    userId,
    amountSEK: total,
    createdAt: new Date().toISOString(),
    paid: true,
    description: `Biljettköp - ${items.length} biljetter`,
  };
  invoices.push(invoice);
  
  return newTickets;
};

export const listUserTickets = async (userId: string): Promise<Ticket[]> => {
  await delay();
  return tickets.filter(t => t.userId === userId);
};

// Memberships
export const listMemberships = async (): Promise<Membership[]> => {
  await delay();
  return memberships;
};

export const startSubscription = async (userId: string, membershipId: string): Promise<Subscription> => {
  await delay();
  const newSub: Subscription = {
    id: `sub-${Date.now()}`,
    userId,
    membershipId,
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    startDate: new Date().toISOString(),
  };
  subscriptions.push(newSub);
  return newSub;
};

export const pauseSubscription = async (id: string): Promise<Subscription> => {
  await delay();
  const sub = subscriptions.find(s => s.id === id);
  if (!sub) throw new Error('Prenumeration hittades inte');
  sub.status = 'paused';
  return sub;
};

export const resumeSubscription = async (id: string): Promise<Subscription> => {
  await delay();
  const sub = subscriptions.find(s => s.id === id);
  if (!sub) throw new Error('Prenumeration hittades inte');
  sub.status = 'active';
  return sub;
};

export const cancelSubscription = async (id: string): Promise<Subscription> => {
  await delay();
  const sub = subscriptions.find(s => s.id === id);
  if (!sub) throw new Error('Prenumeration hittades inte');
  sub.status = 'canceled';
  return sub;
};

// Invoices
export const listInvoices = async (userId?: string): Promise<Invoice[]> => {
  await delay();
  return userId ? invoices.filter(i => i.userId === userId) : invoices;
};

export const createInvoice = async (data: Omit<Invoice, 'id'>): Promise<Invoice> => {
  await delay();
  const newInvoice: Invoice = {
    ...data,
    id: `inv-${Date.now()}`,
  };
  invoices.push(newInvoice);
  return newInvoice;
};

// Points Transactions
export const listPointsTransactions = async (userId: string): Promise<PointsTransaction[]> => {
  await delay();
  return pointsTransactions.filter(pt => pt.userId === userId).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// Payment stubs
export const payWithStripe = async (payload: { amount: number }): Promise<{ status: string; id: string }> => {
  await delay(900);
  return { status: 'succeeded', id: `pi_mock_${Date.now()}` };
};

export const payWithPayPal = async (payload: { amount: number }): Promise<{ status: string; id: string }> => {
  await delay(900);
  return { status: 'COMPLETED', id: `pp_mock_${Date.now()}` };
};

export const payWithSwish = async (payload: { amount: number }): Promise<{ status: string; id: string }> => {
  await delay(900);
  return { status: 'PAID', id: `swish_mock_${Date.now()}` };
};
