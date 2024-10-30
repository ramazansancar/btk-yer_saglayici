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

const fetchCompanies = async (page) => {
  try {
    return await axios.get(
      `https://www.btk.gov.tr/web-api/contentprovider/company?lang=tr&page=${page}`,
      {
        headers: {
          "Accept": "application/json, text/plain, text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "tr,en-US;q=0.9,en;q=0.8,tr-TR;q=0.7,zh-CN;q=0.6,zh-TW;q=0.5,zh;q=0.4,ja;q=0.3,ko;q=0.2,bg;q=0.1",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Host": "www.btk.gov.tr",
          "Origin": "https://www.btk.gov.tr",
          "Referer": `https://www.btk.gov.tr/ticari-amacli-hizmet-verenler-yer-saglayici-listesi?page=${page}`,
          "Pragma": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "sec-ch-ua": "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          pragma: "no-cache",
        },
        ...allowLegacyRenegotiation,
      }
    )
    .then((resp) => {
      let response = resp.data;
      count = response.stats.total;
      console.info(`Fetched ${response.data.length} companies from page ${page}. Total count: ${count}`);
      return response.data;
    })
    .catch((err) => {
      console.error(err?.response?.status, err?.message, err?.response?.data, err);
      return;
    });
  } catch (err) {
    console.error("Error fetching companies:", err?.response?.status, err?.message, err?.response?.data, err);
    return;
  }
}

const fetchAllCompanies = async () => {
  let page = 1;
  let response = await fetchCompanies(page);
  if(response === undefined) response = await fetchCompanies(page);
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
    // 2024-07-24 09:38:25+03 -> 2024-07-24T09:38:25.000Z
    item.approve_date = item.approve_date.replaceAll(' ', 'T').replaceAll('+03', '.000Z').trim();
    
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

  companies.sort((a, b) => {
    return new Date(a.approve_date) - new Date(b.approve_date);
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return companies;
}

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