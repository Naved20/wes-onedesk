# Requirements Document: Payslip Letterhead and Footer

## Introduction

This document specifies the requirements for adding professional WES Foundation letterhead and footer to employee payslips. The letterhead and footer provide organizational branding and contact information for both HTML and PDF formats of payslips, creating a consistent and professional presentation across all payslip documents.

## Glossary

- **Payslip**: An HTML and PDF document displaying employee salary details for a specific period
- **Letterhead**: The header section containing WES Foundation logo, organization name, tagline, and registration details
- **Footer**: The bottom section containing organization address, contact information (email and phone numbers with interactive links)
- **PayslipWrapper**: A reusable React component that composes letterhead, payslip content, and footer
- **PayslipContent**: The existing payslip data structure and HTML rendering, unchanged by this feature
- **HTML Payslip**: The browser-rendered version of the payslip in PayslipView.tsx
- **PDF Payslip**: The generated PDF file created via generatePayslipPDF() using html2canvas and jsPDF
- **WES Foundation**: Wazir Education Society, the parent organization
- **Tagline**: The organization motto: "Change is the end result of all true learning"
- **Contact Information**: Email and WhatsApp phone numbers with interactive links (mailto: and WhatsApp deeplinks)

## Requirements

### Requirement 1: Letterhead Component Display

**User Story:** As an HR administrator, I want payslips to display the WES Foundation letterhead at the top, so that all payslips carry consistent organizational branding and meet professional standards.

#### Acceptance Criteria

1. WHEN a payslip is viewed in HTML format THEN the PayslipWrapper SHALL render the letterhead above the payslip content
2. WHEN a payslip is downloaded as PDF THEN the letterhead SHALL appear at the top of the first page
3. THE letterhead SHALL contain the WES Foundation logo image (from `/src/assets/wes-logo.jpg`) positioned at the top
4. BELOW the logo, THE letterhead SHALL display "WAZIR EDUCATION SOCIETY" as the primary organization name in bold text
5. THE letterhead SHALL display the tagline "Change is the end result of all true learning" below the organization name
6. THE letterhead SHALL display registration details on a separate line: "Registration No. 05/23/01/16310/22  PAN: AABAW20263R  NGO Darpan: MP/2022/0321976"
7. THE letterhead SHALL include a horizontal dividing line (border) below the registration details to separate from the payslip content

### Requirement 2: Footer Component Display

**User Story:** As an HR administrator, I want payslips to display organization contact information in the footer, so that employees always have access to organizational contact details without needing to search elsewhere.

#### Acceptance Criteria

1. WHEN a payslip is viewed in HTML format THEN the PayslipWrapper SHALL render the footer below the payslip content
2. WHEN a payslip is downloaded as PDF THEN the footer SHALL appear at the bottom of the last page
3. THE footer SHALL display a horizontal dividing line (border) above the footer content to separate from the payslip
4. THE footer SHALL use a two-column layout: left column for organization details, right column for contact information
5. IN the left column, THE footer SHALL display the organization name "WAZIR EDUCATION SOCIETY" in bold
6. IN the left column, THE footer SHALL display the complete address: "145, Ward No 15, Micheal Chowk, Dhanpuri, Shahdol, MP 48411"
7. IN the left column, THE footer SHALL display the website URL "www.wazirzeducationsociety.com" as clickable link (https protocol)
8. IN the right column, THE footer SHALL display the email address "info@wazirzeducationsociety.com" with an email icon, formatted as a clickable mailto: link
9. IN the right column, THE footer SHALL display the first WhatsApp number "+917999780490" with a WhatsApp icon, formatted as a clickable WhatsApp deeplink (https://wa.me/)
10. IN the right column, THE footer SHALL display the second WhatsApp number "+917089245919" with a WhatsApp icon, formatted as a clickable WhatsApp deeplink (https://wa.me/)

### Requirement 3: Wrapper Component Architecture

**User Story:** As a developer, I want a reusable PayslipWrapper component, so that letterhead and footer can be easily maintained and applied to both HTML and PDF payslips without modifying existing payslip code.

#### Acceptance Criteria

1. THE PayslipWrapper component SHALL accept PayslipContent as a prop for composing
2. THE PayslipWrapper SHALL compose letterhead + payslip content + footer in a single, unified structure
3. WHEN rendering in HTML, THE PayslipWrapper SHALL apply Tailwind CSS styling for consistent appearance and print-friendly design
4. WHEN rendering in PDF via generatePayslipPDF(), THE PayslipWrapper SHALL ensure letterhead and footer render correctly in the PDF output
5. THE PayslipWrapper SHALL not modify or alter the existing PayslipContent HTML structure or styling
6. THE PayslipWrapper SHALL preserve the existing payslip layout and data display unchanged

### Requirement 4: Integration with PayslipView and PayslipPDF

**User Story:** As a developer, I want the letterhead and footer to integrate seamlessly with existing payslip display and PDF generation code, so that users see consistent formatting across HTML and PDF without code duplication.

#### Acceptance Criteria

1. WHEN PayslipView.tsx renders the payslip THEN the PayslipWrapper SHALL wrap the existing payslip content (#payslip-content element)
2. WHEN generatePayslipPDF() is called THEN the PayslipWrapper structure SHALL be included in the PDF generation via html2canvas
3. THE PayslipWrapper structure SHALL be contained within the #payslip-content element so that PDF generation captures letterhead and footer
4. WHEN the user downloads a PDF THEN the filename and toast notifications SHALL remain unchanged
5. THE existing payslip content layout, spacing, and styling SHALL remain completely unchanged

### Requirement 5: Styling and Print Formatting

**User Story:** As an HR administrator, I want payslips to be print-friendly and visually professional, so that printed copies maintain consistent formatting and appearance.

#### Acceptance Criteria

1. THE letterhead, payslip, and footer SHALL use Tailwind CSS utilities for responsive and consistent styling
2. WHEN the payslip is printed or exported to PDF THEN the print-specific styles (print: prefix in Tailwind) SHALL apply correctly
3. THE letterhead SHALL center-align its content (logo, organization name, tagline, registration details)
4. THE footer text size SHALL be appropriately scaled (smaller than main payslip content) for readability while maintaining hierarchy
5. THE background colors and borders SHALL be visible in both screen and print output
6. THE email and WhatsApp links in the footer SHALL be clickable in both HTML and PDF formats

### Requirement 6: Contact Information Interactivity

**User Story:** As an employee, I want to interact with contact information in the footer, so that I can easily reach out to the organization via email or WhatsApp directly.

#### Acceptance Criteria

1. WHEN an employee clicks the email address in the footer THEN the default email client SHALL open a new message to "info@wazirzeducationsociety.com"
2. WHEN an employee clicks a WhatsApp phone number in the footer THEN the WhatsApp application OR web.whatsapp.com SHALL open with the selected number pre-filled
3. WHEN an employee clicks the website link in the footer THEN the browser SHALL navigate to "https://www.wazirzeducationsociety.com"
4. THE email icon AND WhatsApp icons SHALL be visually distinct from plain text to indicate interactivity
5. THE contact information links SHALL function in both HTML and PDF (where supported by the PDF viewer)

