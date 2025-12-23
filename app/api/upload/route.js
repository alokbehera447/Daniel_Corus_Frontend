import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get all data as array of arrays to see the actual structure
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
      raw: false
    });
    
    console.log('Complete raw data structure:');
    rawData.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}:`, row);
    });
    
    if (rawData.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Excel file has no data rows' },
        { status: 400 }
      );
    }

    // Expected headers based on your Excel structure
    const expectedHeaders = [
      'MARK', 'A(W1)', 'B(W2)', 'C(angle)', 'D(length)', 
      'Thickness', 'α', 'Volume', 'AD', 'UW-(Kg)', 
      'Nos', 'TOT V', 'TOT KG'
    ];
    
    // Find the header row (first row with 'MARK')
    let headerRowIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i] && rawData[i][0] === 'MARK') {
        headerRowIndex = i;
        break;
      }
    }
    
    console.log('Header row found at index:', headerRowIndex);
    console.log('Header row:', rawData[headerRowIndex]);
    
    // Process data rows
    const processedData = rawData.slice(headerRowIndex + 1)
      .filter(row => row && row[0] && row[0] !== 'MARK') // Remove empty rows and header
      .map(row => {
        return {
          'MARK': row[0],
          'A(W1)': row[1],
          'B(W2)': row[2],
          'C(angle)': row[3],
          'D(length)': row[4],
          'Thickness': row[5],
          'α': row[6],
          'Volume': row[7],
          'AD': row[8],
          'UW-(Kg)': row[9],
          'Nos': row[10],
          'TOT V': row[11],
          'TOT KG': row[12]
        };
      })
      .filter(row => row.MARK); // Remove rows without MARK

    console.log('Successfully processed data (first 3 rows):', processedData.slice(0, 3));

    return NextResponse.json({
      success: true,
      data: processedData,
      totalRows: processedData.length,
      headers: expectedHeaders
    });

  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing file: ' + error.message },
      { status: 500 }
    );
  }
}