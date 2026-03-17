import type { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: 'admin' | 'client';
  createdAt: string;
  updatedAt: string;
}

const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack',
  'Karen', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina',
  'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zane', 'Amber', 'Brian', 'Clara', 'Derek',
  'Elena', 'Felix', 'Gina', 'Hugo', 'Irene', 'James', 'Kira', 'Leo', 'Maya', 'Nathan',
  'Opal', 'Peter', 'Rosa', 'Steve', 'Tara', 'Uriel', 'Vera', 'Will', 'Xena', 'Yuri',
  'Zara', 'Adam',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Lopez',
  'Lee', 'Gonzalez', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall', 'Young',
  'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill',
  'Ramirez', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Torres', 'Parker',
  'Collins', 'Edwards',
];

function generateUsers(count: number): MockUser[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${String(i + 1).padStart(3, '0')}`,
    email: `${FIRST_NAMES[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@example.com`,
    phone: i % 3 === 0 ? `+1555000${String(i).padStart(4, '0')}` : null,
    firstName: FIRST_NAMES[i],
    lastName: LAST_NAMES[i],
    userType: (i % 3 === 0 ? 'admin' : 'client') as 'admin' | 'client',
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
  }));
}

const ALL_USERS = generateUsers(52);

export async function mockUsersApi(page: Page) {
  await page.route('**/api/v1/users*', (route) => {
    const url = new URL(route.request().url());
    const pageNum = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 25;
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const userType = url.searchParams.get('userType') || '';
    const sort = url.searchParams.get('sort') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';

    let filtered = ALL_USERS;

    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.firstName.toLowerCase().includes(search) ||
          u.lastName.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search),
      );
    }

    if (userType) {
      filtered = filtered.filter((u) => u.userType === userType);
    }

    filtered = [...filtered].sort((a, b) => {
      const key = sort as keyof MockUser;
      const aVal = String(a[key] ?? '');
      const bVal = String(b[key] ?? '');
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (pageNum - 1) * limit;
    const data = filtered.slice(start, start + limit);

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: { total, page: pageNum, limit, totalPages },
      }),
    });
  });
}
