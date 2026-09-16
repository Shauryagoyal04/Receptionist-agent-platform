import type { IntentId, Outcome, Sentiment } from "@/lib/types";

/*
 * The content the seed script draws from.
 *
 * Uniformly random demo data looks fake and, worse, hides layout bugs: every
 * row ends up the same width, no transcript is long enough to scroll, and no
 * name is long enough to wrap. Everything here is sized and weighted to catch
 * those.
 */

export const DOCTORS = [
  { name: "Dr. Anjali Mehta", speciality: "General Medicine" },
  { name: "Dr. Rajesh Iyer", speciality: "Cardiology" },
  { name: "Dr. Fatima Sheikh", speciality: "Paediatrics" },
  { name: "Dr. Vikram Reddy", speciality: "Orthopaedics" },
  { name: "Dr. Shalini Bhattacharya", speciality: "Dermatology" },
  { name: "Dr. Karan Grewal", speciality: "ENT" },
  { name: "Dr. Meenakshi Subramanian", speciality: "Gynaecology" },
  { name: "Dr. Arif Khan", speciality: "Pulmonology" },
] as const;

export const FIRST_NAMES = [
  "Aarav", "Aditi", "Ananya", "Arjun", "Bhavna", "Chirag", "Deepa", "Devika",
  "Farhan", "Gaurav", "Harsh", "Ishaan", "Jaya", "Kabir", "Kavya", "Lakshmi",
  "Manish", "Meera", "Nikhil", "Nisha", "Pooja", "Pranav", "Priya", "Rahul",
  "Rekha", "Rohan", "Sanjana", "Shreya", "Siddharth", "Sunita", "Tanvi",
  "Uday", "Vaishnavi", "Varun", "Yash", "Zoya",
] as const;

export const LAST_NAMES = [
  "Agarwal", "Balakrishnan", "Chatterjee", "Desai", "Deshpande", "Gupta",
  "Iyer", "Joshi", "Kapoor", "Krishnamurthy", "Malhotra", "Nair", "Patel",
  "Pillai", "Rao", "Reddy", "Sharma", "Singh", "Srinivasan", "Thakur",
  "Venkataraman", "Verma",
] as const;

export const ESCALATION_REASONS = [
  "Insurance query the agent could not answer",
  "Patient complaint about a previous visit",
  "Emergency symptoms mentioned",
  "Agent failed to understand twice",
  "Patient asked for a human",
  "Payment dispute over a consultation fee",
  "Requested a doctor who has left the clinic",
] as const;

export const TAGS = [
  "follow-up", "new-patient", "insurance", "senior-citizen", "walk-in",
  "second-opinion", "vaccination", "lab-work", "urgent", "rescheduled-twice",
] as const;

/** Outcome mix from §13 of the build plan. Weights are relative. */
export const OUTCOME_WEIGHTS: Array<{ outcome: Outcome; weight: number }> = [
  { outcome: "appointment_booked", weight: 45 },
  { outcome: "info_provided", weight: 18 },
  { outcome: "appointment_rescheduled", weight: 12 },
  { outcome: "appointment_cancelled", weight: 8 },
  { outcome: "escalated", weight: 12 },
  { outcome: "no_resolution", weight: 5 },
];

/**
 * Sentiment follows the outcome rather than being rolled independently. A
 * patient whose booking went through is rarely angry, and an escalation is
 * rarely cheerful — random sentiment makes every chart meaningless.
 */
export const SENTIMENT_BY_OUTCOME: Record<
  Outcome,
  Array<{ sentiment: Sentiment; weight: number }>
> = {
  appointment_booked: [
    { sentiment: "positive", weight: 62 },
    { sentiment: "neutral", weight: 35 },
    { sentiment: "negative", weight: 3 },
  ],
  appointment_rescheduled: [
    { sentiment: "positive", weight: 35 },
    { sentiment: "neutral", weight: 55 },
    { sentiment: "negative", weight: 10 },
  ],
  appointment_cancelled: [
    { sentiment: "positive", weight: 12 },
    { sentiment: "neutral", weight: 63 },
    { sentiment: "negative", weight: 25 },
  ],
  info_provided: [
    { sentiment: "positive", weight: 40 },
    { sentiment: "neutral", weight: 56 },
    { sentiment: "negative", weight: 4 },
  ],
  escalated: [
    { sentiment: "positive", weight: 3 },
    { sentiment: "neutral", weight: 27 },
    { sentiment: "negative", weight: 70 },
  ],
  no_resolution: [
    { sentiment: "positive", weight: 2 },
    { sentiment: "neutral", weight: 38 },
    { sentiment: "negative", weight: 60 },
  ],
};

/** Which intent plausibly leads to which outcome. */
export const INTENT_BY_OUTCOME: Record<Outcome, IntentId[]> = {
  appointment_booked: ["book_appointment", "doctor_availability"],
  appointment_rescheduled: ["reschedule_appointment"],
  appointment_cancelled: ["cancel_appointment"],
  info_provided: [
    "clinic_info",
    "consultation_fees",
    "report_status",
    "doctor_availability",
  ],
  escalated: [
    "book_appointment",
    "clinic_info",
    "consultation_fees",
    "other",
    "report_status",
  ],
  no_resolution: ["other", "report_status", "book_appointment"],
};

/**
 * Hourly weights across a 24-hour day, reflecting real clinic traffic: a
 * morning peak around 10–12, a quieter lunch, an evening peak around 17–19,
 * and near-silence overnight. Index is the hour in the clinic's timezone.
 */
export const HOUR_WEIGHTS = [
  0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.5, 3.5, 6, 9,
  13, 13, 9, 6, 5, 6, 8, 12, 12, 8,
  4, 2, 1, 0.5,
] as const;

/** Sunday is a half day; Saturday is busy with people who work weekdays. */
export const WEEKDAY_WEIGHTS = [0.35, 1, 1, 1, 1, 1, 1.15] as const;

export const CLINIC_INFO_ANSWERS = [
  "We're open Monday to Saturday, 9am to 8pm, and Sunday 10am to 2pm.",
  "We're at 14 Residency Road, opposite the Corporation Bank. Parking is behind the building.",
  "Yes, we have an in-house pharmacy open until 9pm.",
  "We accept cash, UPI, and all major cards. Insurance is direct-billed for Star Health and HDFC Ergo.",
];

export const FEE_ANSWERS = [
  "A first consultation is ₹800 and a follow-up within 30 days is ₹400.",
  "Consultation is ₹800. A full blood panel is ₹1,200 and an ECG is ₹600.",
  "Specialist consultations are ₹1,200. Senior citizens get a 15% discount.",
];

/*
 * A handful of transcripts are Hinglish, as they would be in this clinic.
 *
 * The opener has to match what the call is actually about — a patient asking
 * "report ready hai kya?" on a booking call reads as obviously generated, and
 * that is exactly the kind of incoherence a demo gets judged on.
 */
export const HINGLISH_OPENERS: Record<IntentId, readonly string[]> = {
  book_appointment: [
    "Namaste, mujhe doctor ke saath appointment chahiye.",
    "Hello, kya aaj evening ka slot mil sakta hai?",
    "Namaste, kal ke liye appointment book karna hai.",
  ],
  doctor_availability: [
    "Namaste, doctor kab available hain?",
    "Hello, is week doctor ka time kya hai?",
  ],
  reschedule_appointment: [
    "Mujhe apna appointment aage badhana hai.",
    "Namaste, appointment ka time change karna tha.",
  ],
  cancel_appointment: [
    "Mujhe apna appointment cancel karna hai please.",
    "Namaste, kal ka appointment cancel kar dijiye.",
  ],
  report_status: [
    "Bhaiya, report ready hai kya? Kal diya tha sample.",
    "Namaste, blood test ki report aa gayi?",
  ],
  clinic_info: [
    "Namaste, clinic Sunday ko khula rehta hai?",
    "Hello, clinic ka address bata dijiye?",
  ],
  consultation_fees: [
    "Consultation ka charge kitna hai?",
    "Namaste, doctor ki fees kya hai?",
  ],
  other: [
    "Namaste, ek cheez poochhni thi.",
    "Hello, mujhe thodi help chahiye thi.",
  ],
};

export const HINGLISH_AGENT_LINES = [
  "Ji bilkul, main abhi check karti hoon. Aapka naam bata dijiye?",
  "Ji haan, main dekh leti hoon. Aapka naam aur number bata dijiye?",
  "Namaste! Main help kar deti hoon. Aapka naam kya hai?",
];
