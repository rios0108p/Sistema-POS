fetch('https://tendopos.cloud/sw.js')
  .then(res => {
    console.log("Status:", res.status);
    return res.text();
  })
  .then(text => console.log("Body length:", text.length))
  .catch(console.error);
