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

// Function to format rows for MD file
const rowFormatter = (row) => {
  if (row.length === 3) {
    count++;
    totalCount++;
    return `| ${row.join(" | ")} |\n`;
  } else if (row.length === 2) {
    totalCount++;
    return `| ${row[0]} |  | ${row[1]} |\n`;
  }
  return "";
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
        pragma: "no-cache",
      },
      ...allowLegacyRenegotiation,
    }
  );
  count = response.data.stats.total;
  console.info(`Fetched ${response.data.data.length} companies from page ${page}. Total count: ${count}`);
  return response.data.data;
}

async function fetchAllCompanies() {
  let page = 1;
  let response = await fetchCompanies(page);
  companies = [...companies, ...response];
  while (response.length > 0) {
    page++;
    response = await fetchCompanies(page);
    companies = [...companies, ...response];
  }
  return companies;
}

// Sort by ID
companies = companies.sort((a, b) => (a.id > b.id ? 1 : -1));

fetchAllCompanies().then(async (companies) => {
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
    (company.address.includes('|')) ? company.address = company.address.replace('|', ' ') : company.address = company.address;
    (company.web.split('&')) ? company.web = company.web.split('&').join(' ') : company.web = company.web;
    (company.web.split(';')) ? company.web = company.web.split(';').join(' ') : company.web = company.web;
    (company.web.split(',')) ? company.web = company.web.split(',').join(' ') : company.web = company.web;

    writeCache += `| ${company.id} | ${company.company} | ${company.type} | ${company.address} | ${company.phone} | ${company.web} | ${company.approve_date} |\n`;
  });
  await appendToFile(mdPath, writeCache);
  console.log("Markdown file created and updated successfully.");
});