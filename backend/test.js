async function test() {
  const res = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner', password: 'owner123' })
  });
  const data = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

test().catch(console.error);

test().catch(console.error).finally(() => prisma.$disconnect());
