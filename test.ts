fetch('https://ais-pre-4utfza4jbx2dlatcr62r64-157497256116.europe-west2.run.app/api/health', {
  headers: { 'Origin': 'https://example.com' }
}).then(r => console.log(r.status, r.headers.get('access-control-allow-origin'))).catch(console.error)
