import bcrypt from 'bcrypt';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()

async function seedUsers() {
    await Promise.all(users.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10)
        return prisma.user.create({
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                password: hashedPassword
            }
        });
    }));
}

async function seedInvoices() {
    await Promise.all(invoices.map(async(invoice) => {
        return prisma.invoice.create({
            data: {
              customerId: invoice.customer_id,
              amount: invoice.amount,
              status: invoice.status,
              date: new Date(invoice.date).toISOString()
            }
        });
    }));
}

async function seedCustomers() {
    await Promise.all(customers.map(async (customer) => {
        return prisma.customer.create({
            data: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                imageUrl: customer.image_url
            }
        })
    }))
}

async function seedRevenue() {
    await Promise.all(revenue.map(async (rev) => {
        return prisma.revenue.create({
            data: {
                month: rev.month,
                revenue: rev.revenue
            }
        })
    }))
}

export async function GET() {
    seedUsers();
    seedInvoices();
    seedCustomers();
    seedRevenue();
    return Response.json({
    message:
      'Uncomment this file and remove this line. You can delete this file when you are finished.',
  });
}
