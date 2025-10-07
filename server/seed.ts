import { storage } from "./storage";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create sample properties
  const property1 = await storage.createProperty({
    name: "Sunset Apartments",
    address: "123 West Ave, Austin, TX",
    units: 24,
    occupancy: 92,
    monthlyRevenue: "$48,000",
  });

  const property2 = await storage.createProperty({
    name: "Downtown Lofts",
    address: "456 Main St, Austin, TX",
    units: 18,
    occupancy: 88,
    monthlyRevenue: "$36,000",
  });

  const property3 = await storage.createProperty({
    name: "Garden View Estates",
    address: "789 Garden Rd, Austin, TX",
    units: 32,
    occupancy: 95,
    monthlyRevenue: "$64,000",
  });

  const property4 = await storage.createProperty({
    name: "Riverside Complex",
    address: "321 River St, Austin, TX",
    units: 20,
    occupancy: 90,
    monthlyRevenue: "$40,000",
  });

  console.log("✅ Created 4 properties");

  // Create sample leads
  const lead1 = await storage.createLead({
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+1 555-0123",
    propertyId: property1.id,
    propertyName: "Sunset Apartments 2BR",
    status: "new",
    source: "email",
    aiHandled: true,
    income: "$85,000/year",
    moveInDate: "April 1, 2024",
    qualificationScore: 85,
  });

  const lead2 = await storage.createLead({
    name: "Michael Chen",
    email: "m.chen@email.com",
    phone: "+1 555-0456",
    propertyId: property2.id,
    propertyName: "Downtown Loft 1BR",
    status: "prequalified",
    source: "phone",
    aiHandled: true,
    income: "$75,000/year",
    qualificationScore: 78,
  });

  const lead3 = await storage.createLead({
    name: "Emma Wilson",
    email: "emma.w@email.com",
    phone: "+1 555-0789",
    propertyId: property3.id,
    propertyName: "Garden View 3BR",
    status: "contacted",
    source: "sms",
    aiHandled: true,
  });

  const lead4 = await storage.createLead({
    name: "James Lee",
    email: "j.lee@email.com",
    phone: "+1 555-0321",
    propertyId: property1.id,
    propertyName: "Parkside Studio",
    status: "application",
    source: "listing",
    aiHandled: false,
  });

  const lead5 = await storage.createLead({
    name: "Lisa Anderson",
    email: "lisa.a@email.com",
    phone: "+1 555-0654",
    propertyId: property4.id,
    propertyName: "Riverside 2BR",
    status: "prequalified",
    source: "email",
    aiHandled: true,
  });

  console.log("✅ Created 5 leads");

  // Create conversations for lead 1
  await storage.createConversation({
    leadId: lead1.id,
    type: "user",
    channel: "email",
    message: "Hi, I'm interested in the 2BR apartment at Sunset Apartments. Is it still available?",
    aiGenerated: false,
  });

  await storage.createConversation({
    leadId: lead1.id,
    type: "ai",
    channel: "email",
    message: "Hello! Yes, the 2BR apartment is still available. It features modern amenities, in-unit laundry, and a balcony. The monthly rent is $2,400. Would you like to schedule a viewing?",
    aiGenerated: true,
  });

  await storage.createConversation({
    leadId: lead1.id,
    type: "user",
    channel: "email",
    message: "Yes, I'd love to see it. What times are available this week?",
    aiGenerated: false,
  });

  console.log("✅ Created conversations");

  // Create notes for lead 1
  await storage.createNote({
    leadId: lead1.id,
    content: "Lead shows strong interest. Income verified at $85k/year. Credit score pending.",
    aiGenerated: true,
  });

  console.log("✅ Created notes");

  // Create AI settings
  await storage.upsertAISetting({
    category: "templates",
    key: "greeting",
    value: "Hello! Thank you for your interest in {property_name}. I'd be happy to help you with information about our {unit_type} unit.",
  });

  await storage.upsertAISetting({
    category: "qualification",
    key: "min_income_multiplier",
    value: "3",
  });

  await storage.upsertAISetting({
    category: "qualification",
    key: "min_credit_score",
    value: "650",
  });

  console.log("✅ Created AI settings");

  console.log("🎉 Seeding complete!");
}

seed().catch(console.error);
