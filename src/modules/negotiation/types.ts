// Types for Auction Simulation
export interface Competitor {
  id: string;
  name: string;
  lastBid: number;
  isActive: boolean;
  floorPrice: number; // Invisible to user, determines when they drop out
  avatarColor: string;
}

export interface Message {
  sender: 'customer' | 'manager' | 'system' | 'competitor';
  text: string;
  time: string;
  price?: number;
}
