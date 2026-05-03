"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function PdfExportButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("report-content");
      if (!element) throw new Error("Report content not found");

      // Temporarily adjust styles for better PDF rendering if needed
      // e.g. white background for PDF
      const originalBg = element.style.backgroundColor;
      element.style.backgroundColor = "#0B0B0F"; // Keep dark theme or set to white

      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: "#0B0B0F",
      });

      element.style.backgroundColor = originalBg;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("ReviewLens_Report.pdf");
    } catch (err) {
      console.error("PDF export failed", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="text-xs text-[#00C896] hover:text-[#00D4A3] border border-[#00C896]/20 bg-[#00C896]/10 hover:bg-[#00C896]/20 rounded px-3 py-1.5 transition-all disabled:opacity-50"
    >
      {exporting ? "Exporting..." : "Export PDF"}
    </button>
  );
}
