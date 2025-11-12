// Test admin metrics endpoint
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkMTI0NGNiNy05MTAwLTQzODItOWY3ZC1kOTBkMDc5MjA1YjQiLCJlbWFpbCI6ImRyZWVnbGVAZ21haWwuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzMxMzU0ODQ5fQ.wF3CZsVZZ4HxQ_NdAzV0WqKIkC1VzANQjJGP2MV1oGU';

async function testMetrics() {
  console.log('Testing GET /admin/metrics...\n');

  try {
    const response = await fetch('https://npe-api.tem-527.workers.dev/admin/metrics', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Admin metrics endpoint working!');
      console.log(`Total users: ${data.overview?.total_users || 0}`);
      console.log(`Total transformations: ${data.overview?.total_transformations || 0}`);
    } else {
      console.log('\n❌ Error:', data.error || data.details || 'Unknown error');
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

testMetrics();
