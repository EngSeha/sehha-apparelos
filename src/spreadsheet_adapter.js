// Transport-independent staging contract for factory spreadsheets. XLSX parsing can
// feed the same rows after a workbook and its mapping are supplied.
export class FactorySpreadsheetImporter {
  constructor({mapping,required=['code'],allowedFields=[]}){
    if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))throw new Error('Mapping object required');
    this.mapping=mapping;this.required=required;this.allowed=new Set(['code',...allowedFields]);
    for(const [field,column] of Object.entries(mapping))if(!this.allowed.has(field)||typeof column!=='string'||!column.trim())throw new Error(`Invalid mapping for ${field}`);
    if(!mapping.code)throw new Error('Code mapping required');
  }
  stage(rows){
    if(!Array.isArray(rows)||rows.length>1000)throw new Error('Rows must be an array of at most 1000');
    const seen=new Set(),items=[],errors=[];
    rows.forEach((source,index)=>{
      if(!source||typeof source!=='object'||Array.isArray(source)){errors.push({row:index+1,field:'row',message:'Object required'});return;}
      const data={source:'IMPORTED',state:'DRAFT'},missing=[];
      for(const [field,column] of Object.entries(this.mapping)){const value=source[column];if(value==null||String(value).trim()===''){if(this.required.includes(field))missing.push(field);else data[field]=null;}else data[field]=typeof value==='string'?value.trim():value;}
      const code=String(data.code||'').toUpperCase();if(code){if(seen.has(code))errors.push({row:index+1,field:'code',message:'Duplicate code in staged rows'});seen.add(code);data.code=code;}
      for(const field of missing)errors.push({row:index+1,field,message:'Required source value missing; remains TBC'});
      items.push({row:index+1,data});
    });
    return {status:errors.length?'NEEDS_MAPPING_OR_CORRECTION':'READY_FOR_REVIEW',rowCount:rows.length,items,errors,committed:false};
  }
}
export function parseCsv(source){
  if(typeof source!=='string'||source.length>2_000_000)throw new Error('CSV text required, maximum 2 MB');
  const text=source.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('Unclosed CSV quote');if(cell!==''||row.length){row.push(cell);rows.push(row);}
  if(!rows.length)return[];const headers=rows.shift().map(x=>x.trim());if(new Set(headers).size!==headers.length||headers.some(x=>!x))throw new Error('CSV headers must be nonempty and unique');
  return rows.filter(cells=>cells.some(x=>x!=='')).map(cells=>Object.fromEntries(headers.map((h,i)=>[h,cells[i]??''])));
}
export function exportCsv(rows,fields){const escape=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};return [fields.map(escape).join(','),...rows.map(row=>fields.map(field=>escape(row[field])).join(','))].join('\r\n')+'\r\n';}
