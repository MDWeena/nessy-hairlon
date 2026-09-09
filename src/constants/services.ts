import { Sparkles, Heart } from "lucide-react";
import type { ServiceCategory } from "../types";

export const services: ServiceCategory[] = [
  { cat: "Styling", items: [
    { name: "Braiding", price: null, priceRange: "₦15,000 – ₦45,000", desc: "Cornrows, box braids, knotless & more", duration: "3-6 hrs", icon: Sparkles },
    { name: "Locs", price: null, priceRange: "₦10,000 – ₦35,000", desc: "Starter locs, retwist & styling", duration: "2-5 hrs", icon: Sparkles },
    { name: "Crotcheting", price: null, priceRange: "₦12,000 – ₦30,000", desc: "Crotchet braids & twists", duration: "2-4 hrs", icon: Sparkles },
    { name: "Fixing", price: null, priceRange: "₦8,000 – ₦25,000", desc: "Weave-on & sew-in styles", duration: "2-3 hrs", icon: Sparkles },
    { name: "Wigging", price: null, priceRange: "₦10,000 – ₦20,000", desc: "Custom wig install & styling", duration: "1-2 hrs", icon: Sparkles },
  ]},
  { cat: "Treatments", items: [
    { name: "Natural Hair Treatment", price: "₦8,000", desc: "Full natural hair care routine", duration: "1-2 hrs", icon: Heart },
    { name: "Washing", price: "₦5,000", desc: "Shampoo, condition & blow-dry", duration: "45 min", icon: Heart },
    { name: "Deep Conditioning", price: "₦7,000", desc: "Intensive moisture & repair", duration: "1 hr", icon: Heart },
    { name: "Hot Oil Treatment", price: "₦6,000", desc: "Scalp nourishment & shine", duration: "45 min", icon: Heart },
    { name: "Protein Treatment", price: "₦8,000", desc: "Strengthen & restore damaged hair", duration: "1 hr", icon: Heart },
  ]},
];
