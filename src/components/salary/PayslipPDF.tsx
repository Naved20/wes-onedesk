import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "@/hooks/use-toast";

export async function generatePayslipPDF() {
  try {
    const element = document.getElementById("payslip-content");
    if (!element) {
      toast({
        title: "Error",
        description: "Could not find payslip content",
        variant: "destructive",
      });
      return;
    }

    // Show loading toast
    toast({
      title: "Generating PDF",
      description: "Please wait...",
    });

    // Get employee name from the element for filename
    const employeeName = element.querySelector('[data-employee-name]')?.textContent || "Employee";
    const monthYear = element.querySelector('[data-month-year]')?.textContent || "Payslip";
    const filename = `Payslip_${employeeName.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}.pdf`;

    // Create canvas from HTML with better quality
    const canvas = await html2canvas(element, {
      scale: 3, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = 297; // A4 height in mm
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? "portrait" : "portrait",
      unit: "mm",
      format: "a4",
    });

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL("image/png");

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save PDF
    pdf.save(filename);

    toast({
      title: "Success",
      description: `Payslip downloaded as ${filename}`,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast({
      title: "Error",
      description: "Failed to download payslip. Please try again.",
      variant: "destructive",
    });
  }
}
