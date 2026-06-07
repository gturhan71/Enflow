import * as XLSX from 'xlsx';

export const parseBoMFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isXML = file.name.toLowerCase().endsWith('.xml');

    reader.onload = (evt) => {
      const content = evt.target?.result;
      let mappedItems: any[] = [];

      if (isXML) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content as string, "text/xml");
          const items = xmlDoc.querySelectorAll("Item, product, row, item");
          
          mappedItems = Array.from(items).map(item => {
            const getVal = (selectors: string[]) => {
              for (const s of selectors) {
                const el = item.querySelector(s);
                if (el) return el.textContent;
              }
              return '';
            };

            const pn = getVal(['PN', 'PartNumber', 'Part_Number', 'product_code', 'id']);
            const desc = getVal(['Description', 'Desc', 'product_name', 'name', 'aciklama']);
            const qty = parseInt(getVal(['Quantity', 'Qty', 'amount', 'adet', 'miktar']) || '1');
            const cost = parseFloat(getVal(['Cost', 'Price', 'unit_price', 'maliyet', 'fiyat']) || '0');

            return {
              pn: String(pn || ''),
              desc: String(desc || ''),
              qty: isNaN(qty) ? 1 : qty,
              cost: isNaN(cost) ? 0 : cost,
              margin: 15
            };
          }).filter(item => item.pn || item.desc);
          resolve(mappedItems);
        } catch (err) {
          reject(new Error('XML dosyası ayrıştırılamadı.'));
        }
      } else {
        try {
          const bstr = content;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          mappedItems = data.map((row: any) => {
            const pn = row['PN'] || row['Part Number'] || row['Ürün Kodu'] || row['Model'] || '';
            const desc = row['Description'] || row['Açıklama'] || row['Ürün Adı'] || '';
            const qty = parseInt(row['Quantity'] || row['Adet'] || row['Miktar'] || '1');
            const cost = parseFloat(row['Cost'] || row['Maliyet'] || row['Birim Fiyat'] || '0');
            
            return {
              pn: String(pn),
              desc: String(desc),
              qty: isNaN(qty) ? 1 : qty,
              cost: isNaN(cost) ? 0 : cost,
              margin: 15
            };
          }).filter(item => item.pn || item.desc);
          resolve(mappedItems);
        } catch (err) {
          reject(new Error('Excel/CSV dosyası ayrıştırılamadı.'));
        }
      }
    };

    reader.onerror = () => reject(new Error('Dosya okuma hatası.'));

    if (isXML) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};
