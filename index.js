import fs from "fs";
import axios from "axios";
import http from "http";
import https from "https";
import crypto from "crypto";

// Disable SSL certificate validation
const allowLegacyRenegotiation = {
  httpAgent: new http.Agent({
    rejectUnauthorized: false,
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    keepAlive: true,
  }),
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    keepAlive: true,
  }),
};

async function writeFile(filePath, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, content, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function appendToFile(filePath, content) {
  return new Promise((resolve, reject) => {
    fs.appendFile(filePath, content, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

let count = 0;
let companies = [];

String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.split(search).join(replacement);
};

// Base URL: https://www.btk.gov.tr/web-api/contentprovider/company?lang=tr&page=1

async function fetchCompanies(page = 1) {
  const response = await axios.get(
    `https://www.btk.gov.tr/web-api/contentprovider/company?lang=tr&page=${page}`,
    {
      headers: {
        Accept: "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "tr,en-US;q=0.9",
        "cache-control": "no-cache",
        "Referer": "https://www.btk.gov.tr/ticari-amacli-hizmet-verenler-yer-saglayici-listesi?page=1",
        "Origin": "https://www.btk.gov.tr",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        pragma: "no-cache",
      },
      ...allowLegacyRenegotiation,
    }
  );
  count = response.data.stats.total;
  console.info(`Fetched ${response.data.data.length} companies from page ${page}. Total count: ${count}`);
  return response.data.data;
}

const fetchAllCompanies = async () => {
  let page = 1;
  let response = await fetchCompanies(page);
  companies = [...companies, ...response];
  while (response.length > 0) {
    page++;
    response = await fetchCompanies(page);
    companies = [...companies, ...response];
  }
  writeFile("raw_companies.json", JSON.stringify(companies, null, 2));
  companies = companies.map((item) => {
    (item.address.includes('|')) ? item.address = item.address.replace('|', ' ') : item.address = item.address;
    (item.web.split('&')) ? item.web = item.web.split('&').join(' ') : item.web = item.web;
    (item.web.split(';')) ? item.web = item.web.split(';').join(' ') : item.web = item.web;
    (item.web.split(',')) ? item.web = item.web.split(',').join(' ') : item.web = item.web;
    item.company = item.company.replaceAll('  ', ' ').trim();
    item.address = item.address.replaceAll('  ', ' ').replaceAll(';','').replaceAll(/[\t\n\r]/g, ' ').trim();
    item.type = item.type.replaceAll('  ', ' ').trim();
    item.phone = item.phone.replaceAll('  ', ' ').trim();
    item.fax = item.fax.replaceAll('  ', ' ').trim();
    item.web = item.web.replaceAll('‏', '').replaceAll('  ', ' ').trim();
    item.approve_date = item.approve_date.trim();
    
    if(item.phone === '' || item.phone === '-' || item.phone.includes('---')){
      item.phone = null;
    }

    if(item.fax === '' || item.fax === '-' || item.fax.includes('---')){
      item.fax = null;
    }

    if(item.web === ''){
      item.web = null;
    }

    if(item.phone !== null && (item.phone.startsWith('877'))) {
      item.phone = item.phone;
    }else{
      if(item.phone !== null && (!item.phone.startsWith('+90') && !item.phone.startsWith('90'))) {
        item.phone = `+90${item.phone}`;
        item.phone = item.phone.replace('+900', '+90');
      }
    }
    
    if(item.fax !== null && item.fax.startsWith('877')) {
      item.fax = item.fax;
    }else{
      if(item.fax !== null && (!item.fax.startsWith('+90'))) {
        item.fax = `+90${item.fax}`;
        item.fax = item.fax.replace('+900', '+90');
      }
    }


    return item;
  });

  return companies;
}

companies.sort((a, b) => {
  return new Date(a.id) - new Date(b.id);
});


(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
})();

fetchAllCompanies().then(async (data) => {
  console.log("Companies fetched successfully.");
  console.log("Total companies:", companies.length);
  console.log("Total count:", count);
  await writeFile("companies.json", JSON.stringify(companies, null, 2));

  const mdPath = "./README.MD";
  await writeFile(mdPath, "");
  await appendToFile(mdPath, `# Ticari Amaçlı Hizmet Verenler Yer Sağlayıcı Listesi\n\n## Kayıt Sayısı: ${count}\n\n### Kaynak: <https://www.btk.gov.tr/ticari-amacli-hizmet-verenler-yer-saglayici-listesi>\n\n| ID | İşletmeci | Türü | Adres | Telefon | Web | Onay Tarihi |\n| --- | --- | --- | --- | --- | --- | --- |\n`);
  /*
  {
    "id": 3856534,
    "company": "İnteralan Bilişim A.Ş. ",
    "address": "Prof. Dr. Ahmet Taner Kışlalı Mah. 2873 Cad. Ulucan Sit. No:3 İç Kapı No:5 Çankaya",
    "type": "company",
    "fax": "3124290220",
    "phone": "8508850222",
    "web": "https://interalan.com",
    "approve_date": "2024-10-08 19:33:52+03"
  },
  {
    "id": 3856544,
    "company": "MSY BASIM YAYIN VE REKLAMCILIK TİC. SAN. LTD. ŞTİ ",
    "address": "Yakuplu Mah., E-5 Karayolu Haramidere Cad. Hasırcılar İş Merkezi No:34/J Beylikdüzü / İSTANBUL",
    "type": "company",
    "fax": "",
    "phone": "05325500085",
    "web": "https://msyajans.com",
    "approve_date": "2024-10-24 14:07:31+03"
  }
  */
  let writeCache = ``;
  companies.forEach((company) => {
    writeCache += `| ${company.id} | ${company.company} | ${company.type} | ${company.address} | ${company.phone} | ${company.web} | ${company.approve_date} |\n`;
  });
  await appendToFile(mdPath, writeCache);
  console.log("Markdown file created and updated successfully.");
});