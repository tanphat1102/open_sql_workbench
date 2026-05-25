const axios = require('axios');

async function test() {
  console.log("Calling next API mock...");
  try {
    const res = await axios.post('http://localhost:3000/api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/SqlwbResultSet(\'RUNQUERY\')?ProfileId=\'DEV\'&SqlText=\'SELECT%20*%20FROM%20mara\'&Page=1', {}, {
      headers: {
        'Cookie': 'SAP_SESSIONID_S40_324=test', // we might get 401 but let's see NextJS behavior
      }
    });
    console.log(res.status);
  } catch (e) {
    console.log(e.response?.status, e.response?.data);
  }
}
test();
