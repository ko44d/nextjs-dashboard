import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { PrismaClient } from '@prisma/client';
import {Prisma} from "@prisma/client/extension";

const prisma = new PrismaClient()

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {

    const data : any[] = await prisma.$queryRaw`
                     SELECT "Invoice".amount, "Customer".name, "Customer"."imageUrl", "Customer".email, "Invoice".id
                     FROM "Invoice"
                     JOIN "Customer" ON "Invoice"."customerId" = "Customer".id
                     ORDER BY "Invoice".date DESC LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCount =  prisma.invoice.count();
    const customerCount =  prisma.customer.count();
    const paidAmount =  prisma.invoice.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'paid',
      },
    });
    const pendingAmount = prisma.invoice.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'pending',
      },
    });

    const data = await Promise.all([
        prisma.invoice.count(),
        prisma.customer.count(),
        prisma.invoice.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            status: 'paid',
          },
        }),
        prisma.invoice.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            status: 'pending',
          },
        }),
    ])

    const numberOfInvoices = Number(data[0] ?? '0');
    const numberOfCustomers = Number(data[1] ?? '0');
    const totalPaidInvoices = formatCurrency((data[2]._sum.amount || 0) ?? '0');
    const totalPendingInvoices = formatCurrency((data[3]._sum.amount || 0) ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const result : any[] = await prisma.$queryRaw`
      SELECT
        "Invoice".id,
        "Invoice".amount,
        "Invoice".date,
        "Invoice".status,
        "Customer".name,
        "Customer".email,
        "Customer"."imageUrl"
      FROM "Invoice"
      JOIN "Customer" ON "Invoice"."customerId" = "Customer".id
      WHERE
        "Customer".name ILIKE ${`%${query}%`} OR
        "Customer".email ILIKE ${`%${query}%`} OR
        "Invoice".amount::text ILIKE ${`%${query}%`} OR
        "Invoice".date::text ILIKE ${`%${query}%`} OR
        "Invoice".status ILIKE ${`%${query}%`}
      ORDER BY "Invoice".date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return result;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
