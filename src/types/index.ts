export type Role = 'ADMIN' | 'INSTRUKTOR' | 'MEDLEM';

export type DanceStyle = 'Salsa' | 'Bachata' | 'Tango' | 'Kizomba' | 'Zouk' | 'HipHop';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
  pointsBalance: number;
  memberships: Membership[];
}

export interface Course {
  id: string;
  title: string;
  style: DanceStyle;
  totalLessons: number;
  startDate: string;
  endDate: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  time: string;
  location: string;
  description?: string;
  instructorId?: string;
  mediaUrl?: string;
  priceSEK: number;
}

export interface ClassSession {
  id: string;
  courseId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  instructorId?: string;
  attendees?: string[]; // User IDs
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  mediaUrl?: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  priceSEK: number;
  stock: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  typeId: string;
  qrCode: string;
  issuedAt: string;
  used: boolean;
}

export interface Membership {
  id: string;
  name: string;
  priceSEK: number;
  interval: 'month' | 'year';
  benefits: string[];
  status: 'active' | 'past_due' | 'canceled';
}

export interface Subscription {
  id: string;
  userId: string;
  membershipId: string;
  status: 'active' | 'paused' | 'canceled';
  currentPeriodEnd: string;
  startDate: string;
}

export interface Invoice {
  id: string;
  userId: string;
  amountSEK: number;
  createdAt: string;
  paid: boolean;
  pdfUrl?: string;
  description?: string;
}

export interface PaymentProvider {
  id: 'stripe' | 'paypal';
  enabled: boolean;
  note?: string;
}

export interface Notification {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  to: string;
  subject?: string;
  message: string;
  createdAt: string;
  status: 'queued' | 'sent' | 'failed';
}

export interface PointsTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'purchase' | 'usage' | 'adjustment';
  description: string;
  createdAt: string;
  relatedId?: string; // Course ID or Session ID
}

export interface CartItem {
  id: string;
  type: 'ticket' | 'course';
  itemId: string;
  name: string;
  priceSEK: number;
  quantity: number;
}
