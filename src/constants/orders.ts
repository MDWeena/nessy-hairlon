import type { Order } from "../types";

export const fakeOrders: Order[] = [
  { id: "BK-001", client: "Amara Okafor", service: "Box Braids (custom)", date: "Mon, Sep 8", time: "9:00 AM", status: "confirmed", price: "₦25,000" },
  { id: "BK-002", client: "Chidinma Eze", service: "Deep Conditioning", date: "Mon, Sep 8", time: "2:00 PM", status: "confirmed", price: "₦7,000" },
  { id: "BK-003", client: "Bola Adeyemi", service: "Knotless Braids (custom)", date: "Tue, Sep 9", time: "10:00 AM", status: "pending_review", price: null },
  { id: "BK-004", client: "Ngozi Uche", service: "Locs Retwist (custom)", date: "Tue, Sep 9", time: "3:00 PM", status: "quoted", price: "₦15,000" },
  { id: "BK-005", client: "Fatima Ibrahim", service: "Washing + Protein Treatment", date: "Wed, Sep 10", time: "11:00 AM", status: "confirmed", price: "₦13,000" },
  { id: "BK-006", client: "Ada Nwosu", service: "Cornrows (custom)", date: "Thu, Sep 11", time: "9:00 AM", status: "pending_review", price: null },
];
