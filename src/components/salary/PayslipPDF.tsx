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

    // Clone the element into an off-screen container at desktop width.
    // This avoids touching the live DOM (which caused badge/text misalignment)
    // while still forcing Tailwind's lg: breakpoints to fire correctly on mobile.
    const DESKTOP_WIDTH = 1200;

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "-9999px";
    container.style.width = `${DESKTOP_WIDTH}px`;
    container.style.background = "#ffffff";
    container.style.zIndex = "-1";
    document.body.appendChild(container);

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = `${DESKTOP_WIDTH}px`;
    clone.style.maxWidth = `${DESKTOP_WIDTH}px`;
    container.appendChild(clone);

    // Let the browser fully lay out the clone before capturing
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Create canvas from the off-screen clone
    const canvas = await html2canvas(clone, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: DESKTOP_WIDTH,
      windowHeight: clone.scrollHeight,
    });

    // Clean up the off-screen clone
    document.body.removeChild(container);

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;

    // Scale image to fit exactly one A4 page
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    // If content is taller than A4, scale it down to fit
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    if (imgHeight > pageHeight) {
      const ratio = pageHeight / imgHeight;
      finalWidth = imgWidth * ratio;
      finalHeight = pageHeight;
    }

    // Center horizontally if scaled down
    const xOffset = (pageWidth - finalWidth) / 2;

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // JPEG at 0.92 quality — 3-5x smaller than PNG, visually identical for payslips
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    // Always fit on a single page
    pdf.addImage(imgData, "JPEG", xOffset, 0, finalWidth, finalHeight);

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
