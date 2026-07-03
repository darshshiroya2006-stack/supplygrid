import bcrypt from "bcryptjs";
import {
  db,
  adminsTable,
  customersTable,
  productsTable,
  customerPricingTable,
  ordersTable,
  orderItemsTable,
  inquiriesTable,
  stockEntriesTable,
  pool,
} from "@workspace/db";

type PriceKey = string;
const priceKey = (customerId: number, productId: number): PriceKey =>
  `${customerId}:${productId}`;

async function main() {
  console.log("Seeding...");

  await db.delete(orderItemsTable);
  await db.delete(ordersTable);
  await db.delete(customerPricingTable);
  await db.delete(inquiriesTable);
  await db.delete(stockEntriesTable);
  await db.delete(customersTable);
  await db.delete(productsTable);
  await db.delete(adminsTable);

  await db.insert(adminsTable).values({
    username: "admin",
    passwordHash: bcrypt.hashSync("admin", 10),
    name: "Owner",
  });

  const products = await db
    .insert(productsTable)
    .values([
      {
        name: "Aloo Bhujia",
        description: "Crispy spiced potato sev — bestseller across Rajasthan",
        category: "Bhujia",
        unit: "1 KG",
        basePrice: "240.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Bikaneri Bhujia",
        description: "Classic moth-dal bhujia, fine cut, robust spice",
        category: "Bhujia",
        unit: "1 KG",
        basePrice: "260.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Moong Dal Namkeen",
        description: "Fried split moong dal, salted and crunchy",
        category: "Dal",
        unit: "1 KG",
        basePrice: "300.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Masala Peanuts",
        description: "Roasted peanuts coated in besan and spices",
        category: "Peanuts",
        unit: "1 KG",
        basePrice: "220.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Navratan Mix",
        description: "Nine-ingredient mixture — sev, peanuts, dal, kishmish",
        category: "Mixtures",
        unit: "1 KG",
        basePrice: "280.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Khatta Meetha",
        description: "Sweet and tangy mixture with raisins",
        category: "Mixtures",
        unit: "1 KG",
        basePrice: "270.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Chakli",
        description: "Spiral fried snack made from rice and gram flour",
        category: "Fried",
        unit: "1 KG",
        basePrice: "230.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Mathri",
        description: "Flaky savoury North-Indian biscuit",
        category: "Fried",
        unit: "1 KG",
        basePrice: "210.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Sev",
        description: "Fine besan sev for chaat and topping",
        category: "Sev",
        unit: "1 KG",
        basePrice: "200.00",
        imageUrl: null,
        inStock: true,
      },
      {
        name: "Cornflakes Mixture",
        description: "Crunchy cornflakes mixed with peanuts and curry leaves",
        category: "Mixtures",
        unit: "1 KG",
        basePrice: "290.00",
        imageUrl: null,
        inStock: false,
      },
    ])
    .returning();

  const customers = await db
    .insert(customersTable)
    .values([
      {
        shopName: "Sharma Kirana Store",
        ownerName: "Ramesh Sharma",
        username: "demo",
        passwordHash: bcrypt.hashSync("demo", 10),
        phone: "+91 98123 45670",
        address: "12 MG Road",
        city: "Jaipur",
        notes: "Prefers weekly delivery",
      },
      {
        shopName: "Gupta Provisions",
        ownerName: "Sunita Gupta",
        username: "gupta",
        passwordHash: bcrypt.hashSync("gupta123", 10),
        phone: "+91 98990 11223",
        address: "Sector 21",
        city: "Delhi",
        notes: null,
      },
      {
        shopName: "Patel General Store",
        ownerName: "Kiran Patel",
        username: "patel",
        passwordHash: bcrypt.hashSync("patel123", 10),
        phone: "+91 99220 88110",
        address: "Lal Darwaja",
        city: "Ahmedabad",
        notes: "Bulk orders monthly",
      },
      {
        shopName: "Verma Snack House",
        ownerName: "Anil Verma",
        username: "verma",
        passwordHash: bcrypt.hashSync("verma123", 10),
        phone: "+91 90113 22445",
        address: "Hazratganj",
        city: "Lucknow",
        notes: null,
      },
    ])
    .returning();

  const demo = customers[0];
  const gupta = customers[1];

  const pricingRows = [
    { customerId: demo.id, productId: products[0].id, customPrice: "220.00" },
    { customerId: demo.id, productId: products[2].id, customPrice: "285.00" },
    { customerId: demo.id, productId: products[4].id, customPrice: "265.00" },
    { customerId: gupta.id, productId: products[1].id, customPrice: "245.00" },
    { customerId: gupta.id, productId: products[5].id, customPrice: "255.00" },
  ];
  await db.insert(customerPricingTable).values(pricingRows);
  const customPriceMap = new Map<PriceKey, number>(
    pricingRows.map((r) => [priceKey(r.customerId, r.productId), Number(r.customPrice)]),
  );

  // Seed orders for the last 30 days
  const today = new Date();
  const ordersToInsert: Array<{
    customer: typeof customers[number];
    daysAgo: number;
    items: Array<{ idx: number; qty: number }>;
  }> = [
    { customer: demo, daysAgo: 1, items: [{ idx: 0, qty: 5 }, { idx: 4, qty: 3 }] },
    { customer: demo, daysAgo: 4, items: [{ idx: 2, qty: 2 }, { idx: 8, qty: 4 }] },
    { customer: demo, daysAgo: 12, items: [{ idx: 0, qty: 10 }] },
    { customer: gupta, daysAgo: 2, items: [{ idx: 1, qty: 8 }, { idx: 5, qty: 4 }] },
    { customer: gupta, daysAgo: 9, items: [{ idx: 3, qty: 6 }, { idx: 7, qty: 5 }] },
    { customer: gupta, daysAgo: 20, items: [{ idx: 1, qty: 12 }] },
    { customer: customers[2], daysAgo: 3, items: [{ idx: 6, qty: 7 }, { idx: 8, qty: 5 }] },
    { customer: customers[2], daysAgo: 15, items: [{ idx: 4, qty: 8 }, { idx: 5, qty: 6 }] },
    { customer: customers[3], daysAgo: 6, items: [{ idx: 0, qty: 4 }, { idx: 2, qty: 3 }, { idx: 8, qty: 5 }] },
    { customer: customers[3], daysAgo: 25, items: [{ idx: 7, qty: 10 }] },
  ];

  for (const o of ordersToInsert) {
    const createdAt = new Date(today.getTime() - o.daysAgo * 24 * 60 * 60 * 1000);
    let total = 0;
    const lineRows: Array<{
      productId: number;
      productName: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      lineTotal: string;
    }> = [];
    for (const it of o.items) {
      const p = products[it.idx];
      const custom = customPriceMap.get(priceKey(o.customer.id, p.id));
      const unitPrice = custom ?? Number(p.basePrice);
      const lineTotal = unitPrice * it.qty;
      total += lineTotal;
      lineRows.push({
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        quantity: String(it.qty),
        unitPrice: String(unitPrice),
        lineTotal: String(lineTotal),
      });
    }
    const [order] = await db
      .insert(ordersTable)
      .values({
        customerId: o.customer.id,
        status: "unprocessed",
        totalAmount: String(total),
        notes: null,
        createdAt,
      })
      .returning();
    await db.insert(orderItemsTable).values(lineRows.map((l) => ({ ...l, orderId: order.id })));
  }

  await db.insert(inquiriesTable).values([
    {
      name: "Mahesh Joshi",
      shopName: "Joshi Trading Co",
      phone: "+91 99000 11223",
      email: "mahesh@example.com",
      message: "Interested in wholesale rates for assorted namkeen for our retail chain.",
    },
    {
      name: "Priya Singh",
      shopName: null,
      phone: "+91 98876 54321",
      email: null,
      message: "Looking for sample pack and pricing for monthly supply.",
    },
  ]);

  const stockEntriesToInsert = [
    {
      date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      supplierName: "Bikaner Snacks Pvt Ltd",
      productName: "Bikaneri Bhujia",
      quantityKg: "200",
      totalPrice: "38000.00",
      notes: "Fresh stock",
    },
    {
      date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      supplierName: "Marwar Foods",
      productName: "Aloo Bhujia",
      quantityKg: "150",
      totalPrice: "27000.00",
      notes: null,
    },
    {
      date: new Date(today.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      supplierName: "Anand Namkeen House",
      productName: "Moong Dal Namkeen",
      quantityKg: "100",
      totalPrice: "24000.00",
      notes: "Premium grade",
    },
    {
      date: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      supplierName: "Surya Trading",
      productName: "Sev",
      quantityKg: "180",
      totalPrice: "28800.00",
      notes: null,
    },
  ];

  await db.insert(stockEntriesTable).values(
    stockEntriesToInsert.map((se) => {
      const product = products.find(p => p.name.trim().toLowerCase() === se.productName.trim().toLowerCase());
      return {
        ...se,
        productId: product ? product.id : null,
      };
    })
  );

  console.log("Seed complete");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
