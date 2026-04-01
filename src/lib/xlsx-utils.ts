import * as XLSX from "xlsx";

/**
 * Downloads an XLSX workbook as a proper .xlsx file using Blob,
 * ensuring the file is editable and doesn't corrupt when moved.
 */
export const downloadXlsx = (workbook: XLSX.WorkBook, filename: string) => {
  const wbout = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    bookSST: true,
  });

  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
