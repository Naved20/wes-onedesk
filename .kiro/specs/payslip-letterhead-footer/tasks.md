# Implementation Plan: Payslip Letterhead and Footer

## Overview

This implementation plan adds professional WES Foundation letterhead and footer to payslips in both HTML and PDF formats. The solution creates three new reusable components (PayslipLetterhead, PayslipFooter, and PayslipWrapper) that compose the letterhead, existing payslip content, and footer into a unified structure. PayslipView.tsx is updated to use the wrapper, while all existing payslip logic and PDF generation remain unchanged.

## Tasks

- [x] 1. Create PayslipLetterhead component
  - Create `src/components/salary/PayslipLetterhead.tsx`
  - Render WES Foundation logo from `/src/assets/wes-logo.jpg` with onError fallback
  - Display centered organization name "WAZIR EDUCATION SOCIETY" in bold
  - Display tagline "Change is the end result of all true learning" in italics
  - Display registration details: "Registration No. 05/23/01/16310/22  PAN: AABAW20263R  NGO Darpan: MP/2022/0321976"
  - Apply Tailwind styling: centered layout, gray-300 bottom border, print-friendly styles
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Create PayslipFooter component
  - Create `src/components/salary/PayslipFooter.tsx`
  - Implement two-column grid layout (left: organization, right: contact)
  - Left column: display organization name (bold), address, and website link
  - Right column: display email with Mail icon as clickable mailto: link
  - Right column: display two WhatsApp numbers with MessageCircle icons as clickable wa.me deeplinks
  - Apply Tailwind styling: grid layout, responsive design, gray-300 top border
  - Use lucide-react icons (Mail, MessageCircle) for visual indicators
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [ ] 3. Create PayslipWrapper component
  - Create `src/components/salary/PayslipWrapper.tsx`
  - Accept children prop for existing payslip content
  - Compose PayslipLetterhead + children + PayslipFooter in vertical order
  - Ensure wrapper renders within a container div for proper composition
  - Do not modify children structure or styling
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Integrate PayslipWrapper into PayslipView.tsx
  - Import PayslipWrapper, PayslipLetterhead, and PayslipFooter components
  - Wrap existing payslip content with PayslipWrapper inside the CardContent element
  - Ensure #payslip-content ID is maintained on CardContent for PDF generation
  - Verify existing payslip content remains unchanged in structure and styling
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Verify PDF generation captures letterhead and footer
  - Test generatePayslipPDF() with wrapped payslip structure
  - Confirm html2canvas captures letterhead, content, and footer
  - Verify PDF file includes all three sections with correct styling
  - Confirm PDF generation code in PayslipPDF.tsx requires no changes
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 6. Apply print-friendly styling and media queries
  - Add Tailwind print: prefixed classes to letterhead and footer
  - Ensure borders remain visible in print output (print:border-black)
  - Test browser print functionality (Ctrl+P / Cmd+P) to verify layout
  - Verify print output matches design specifications
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 7. Test contact link functionality and accessibility
  - Test email link (mailto:) opens default email client
  - Test both WhatsApp links (wa.me) open WhatsApp or web.whatsapp.com
  - Test website link navigates to correct HTTPS URL
  - Verify links function in both HTML view and PDF viewer
  - Verify icon + text makes contact methods visually identifiable
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Test responsive layout and cross-browser compatibility
  - Test letterhead and footer on desktop, tablet, and mobile viewports
  - Verify layout remains professional and readable on all screen sizes
  - Test in Chrome, Firefox, Safari, and Edge
  - Verify no console errors or styling issues
  - _Requirements: 5.1, 5.2_

- [ ] 9. Checkpoint - Verify all requirements are met
  - Ensure all seven requirements from requirements.md are satisfied
  - Confirm no existing payslip functionality is broken
  - Verify letterhead/footer appear in both HTML and PDF
  - Test with multiple employees to ensure consistency
  - Confirm existing payslip structure and styling unchanged

