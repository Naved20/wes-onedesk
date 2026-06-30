# Design Document: Payslip Letterhead and Footer

## Introduction

This design document specifies the architecture and implementation approach for adding professional letterhead and footer to WES Foundation payslips. The solution creates a reusable `PayslipWrapper` component that composes letterhead, payslip content, and footer into a unified structure, enabling consistent branding across HTML and PDF formats without modifying existing payslip code.

## Architecture Overview

### High-Level Structure

```
PayslipWrapper (NEW)
├── PayslipLetterhead (NEW)
│   ├── Logo Image
│   ├── Organization Name
│   ├── Tagline
│   └── Registration Details
├── PayslipContent (EXISTING - UNCHANGED)
│   └── All existing payslip HTML structure
└── PayslipFooter (NEW)
    ├── Left Column (Organization Details)
    │   ├── Organization Name
    │   ├── Address
    │   └── Website Link
    └── Right Column (Contact Information)
        ├── Email Link with Icon
        ├── WhatsApp #1 Link with Icon
        └── WhatsApp #2 Link with Icon
```

### Design Principles

1. **Non-invasive**: Existing PayslipView and PayslipPDF code remain unchanged
2. **Reusable**: Letterhead and footer components are self-contained and can be used independently
3. **Composable**: PayslipWrapper enables flexible composition of letterhead + content + footer
4. **Print-friendly**: All styling uses Tailwind CSS with print media queries for consistent output
5. **Accessible**: Contact links use semantic HTML (mailto:, tel:, deeplinks) for accessibility

## Component Design

### 1. PayslipLetterhead Component

**Location:** `src/components/salary/PayslipLetterhead.tsx`

**Responsibility:** Render the professional letterhead section at the top of payslips

**Structure:**
```typescript
interface PayslipLetterheadProps {
  // No props required - static content
}

export function PayslipLetterhead(): JSX.Element {
  // Renders:
  // - Logo (WES Foundation logo from assets)
  // - Organization name (centered, bold)
  // - Tagline (centered, italicized)
  // - Registration details (centered, small text)
  // - Horizontal dividing border
}
```

**Styling Details:**
- Container: `w-full text-center py-6 border-b-2 border-gray-300`
- Logo: `h-16 mx-auto mb-2` (responsive height)
- Organization Name: `text-2xl font-bold text-gray-800`
- Tagline: `text-sm italic text-gray-600 mb-2`
- Registration Details: `text-xs text-gray-500 leading-tight`

### 2. PayslipFooter Component

**Location:** `src/components/salary/PayslipFooter.tsx`

**Responsibility:** Render contact information and organization details at the bottom of payslips

**Structure:**
```typescript
interface PayslipFooterProps {
  // No props required - static content
}

export function PayslipFooter(): JSX.Element {
  // Renders two-column layout:
  // Left: Organization name, address, website
  // Right: Email, WhatsApp numbers with icons
}
```

**Styling Details:**
- Container: `w-full border-t-2 border-gray-300 pt-4 mt-8`
- Grid: `grid grid-cols-2 gap-6 text-sm`
- Left Column: `text-gray-800`
  - Organization: `font-bold mb-2`
  - Address: `text-xs text-gray-600 leading-tight mb-2`
  - Website: `text-blue-600 hover:underline`
- Right Column: `text-gray-800`
  - Each item: `flex items-center gap-2 mb-2`
  - Icons: Lucide React (Mail for email, MessageCircle for WhatsApp)
  - Links: `text-blue-600 hover:underline`

**Contact Link Format:**
```
Email:       mailto:info@wazirzeducationsociety.com
WhatsApp #1: https://wa.me/917999780490
WhatsApp #2: https://wa.me/917089245919
Website:     https://www.wazirzeducationsociety.com
```

### 3. PayslipWrapper Component

**Location:** `src/components/salary/PayslipWrapper.tsx`

**Responsibility:** Compose letterhead, payslip content, and footer into a unified, printable structure

**Structure:**
```typescript
interface PayslipWrapperProps {
  children: React.ReactNode; // Existing payslip content
}

export function PayslipWrapper({ children }: PayslipWrapperProps): JSX.Element {
  // Renders:
  // 1. PayslipLetterhead
  // 2. children (PayslipContent - unchanged)
  // 3. PayslipFooter
  // All within the #payslip-content div for PDF generation
}
```

**Integration Points:**
- Wraps the PayslipContent (the existing payslip HTML)
- Container div maintains id="payslip-content" for PDF generation
- All styling is additive; no existing payslip styles are modified

### 4. Integration in PayslipView.tsx

**Current Structure:**
```typescript
<Card className="border-2 print:border-black print:shadow-none">
  <CardContent className="p-8 print:p-4" id="payslip-content">
    {/* Existing payslip content */}
  </CardContent>
</Card>
```

**Modified Structure:**
```typescript
<Card className="border-2 print:border-black print:shadow-none">
  <CardContent className="p-8 print:p-4" id="payslip-content">
    <PayslipWrapper>
      {/* Existing payslip content (moved here, unchanged) */}
    </PayslipWrapper>
  </CardContent>
</Card>
```

**Change Summary:**
- The existing payslip content remains exactly as-is
- PayslipWrapper composition occurs at the CardContent level
- No modifications to PayslipView logic or state
- ID remains on CardContent for PDF generation

### 5. PDF Generation Compatibility

**Current Flow:**
```
generatePayslipPDF() 
  → getElementById("payslip-content")
  → html2canvas()
  → jsPDF.addImage()
```

**No Changes Required:**
- PayslipWrapper is a div-based composition at the HTML level
- html2canvas captures the entire #payslip-content structure
- Letterhead and footer are automatically included in the canvas rendering
- No modifications to PayslipPDF.tsx logic
- No modifications to canvas rendering parameters

## Data Models and Interfaces

### PayslipLetterhead

Static component - no data interface needed. Content is hardcoded:
- Logo path: `/src/assets/wes-logo.jpg`
- Organization: `"WAZIR EDUCATION SOCIETY"`
- Tagline: `"Change is the end result of all true learning"`
- Registration: `"Registration No. 05/23/01/16310/22  PAN: AABAW20263R  NGO Darpan: MP/2022/0321976"`

### PayslipFooter

Static component - no data interface needed. Content is hardcoded:

**Left Column:**
- Organization: `"WAZIR EDUCATION SOCIETY"`
- Address: `"145, Ward No 15, Micheal Chowk, Dhanpuri, Shahdol, MP 48411"`
- Website: `"www.wazirzeducationsociety.com"` (rendered as link to `https://...`)

**Right Column:**
- Email: `"info@wazirzeducationsociety.com"`
- WhatsApp #1: `"+917999780490"`
- WhatsApp #2: `"+917089245919"`

## Error Handling and Edge Cases

### Missing Logo Image

**Case:** Logo file at `/src/assets/wes-logo.jpg` is missing or fails to load

**Handling:**
- Implement `onError` handler on img element
- Fallback to placeholder text: `"WES"`
- Log warning to console for debugging

**Code:**
```typescript
<img 
  src={logoPath} 
  alt="WES Foundation Logo"
  className="h-16 mx-auto mb-2"
  onError={(e) => {
    console.warn("Logo failed to load");
    e.currentTarget.style.display = "none";
  }}
/>
```

### Link Handling in PDF

**Case:** Email/WhatsApp links may not be clickable in all PDF viewers

**Approach:**
- Implement semantic HTML (href attributes) correctly
- Links work in modern PDF viewers (Adobe Reader, browser viewers)
- Some viewers may show link tooltips but not open URLs
- This is a PDF viewer limitation, not a code issue

**Mitigation:**
- Display full contact information in footer as fallback text
- Icons make it clear these are contact methods

## Styling Strategy

### Tailwind CSS Classes

**Letterhead Container:**
```css
w-full text-center py-6 border-b-2 border-gray-300 print:border-black
```

**Footer Container:**
```css
w-full border-t-2 border-gray-300 pt-4 mt-8 print:border-black text-sm
```

**Print Media Queries:**
```css
print:border-black  /* Darker borders for print */
print:text-black   /* Ensure text is black for print */
```

### Responsive Design

- Logo height: `h-16` (responsive, adjusts with TailwindCSS breakpoints)
- Footer layout: `grid grid-cols-2` (2-column on all screen sizes)
- On mobile/tablet: Footer columns stack via responsive grid
- Print output: Fixed layout for consistent PDF rendering

## Testing Considerations

### Unit Testing

1. **PayslipLetterhead:**
   - Verify logo renders with correct src
   - Verify organization name is displayed
   - Verify tagline is displayed
   - Verify registration details are displayed

2. **PayslipFooter:**
   - Verify all contact information is displayed
   - Verify email link href is correct (mailto:)
   - Verify WhatsApp links use wa.me protocol
   - Verify website link is correct

3. **PayslipWrapper:**
   - Verify letterhead is above children
   - Verify footer is below children
   - Verify children are rendered unchanged

### Integration Testing

1. **HTML Display:**
   - Verify letterhead/footer appear in PayslipView
   - Verify existing payslip content is unchanged
   - Verify responsive layout on mobile/tablet/desktop

2. **PDF Generation:**
   - Verify generatePayslipPDF() captures letterhead and footer
   - Verify PDF file includes all three sections
   - Verify links are rendered in PDF (though may not be clickable)

### Manual Testing

1. Print payslip from browser (Ctrl+P / Cmd+P)
2. Download PDF and verify in PDF viewer
3. Test clicking email/WhatsApp links in HTML
4. Verify styling matches design requirements

## Implementation Notes

### File Creation/Modification Summary

**New Files:**
1. `src/components/salary/PayslipLetterhead.tsx` - Letterhead component
2. `src/components/salary/PayslipFooter.tsx` - Footer component
3. `src/components/salary/PayslipWrapper.tsx` - Wrapper component

**Modified Files:**
1. `src/components/salary/PayslipView.tsx` - Import and use PayslipWrapper

**Unchanged Files:**
1. `src/components/salary/PayslipPDF.tsx` - No changes needed
2. All other payslip-related files - No changes

### Dependencies

- `lucide-react` - Already available for Mail and MessageCircle icons
- `clsx` - Already available for conditional class styling (if needed)
- No new external dependencies required

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- PDF viewers with link support (Adobe Reader, browser-based)
- Print functionality (all modern browsers)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Letterhead Composition

For any payslip view rendering, the letterhead component SHALL compose and render exactly four visual elements in sequence: the WES logo image, the organization name "WAZIR EDUCATION SOCIETY", the tagline "Change is the end result of all true learning", and the registration details, separated by a horizontal border.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Footer Composition

For any payslip view rendering, the footer component SHALL compose a two-column layout containing exactly seven text/link elements: left column with organization name, address, and website link; right column with email link and two WhatsApp links, separated from payslip content by a horizontal border.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

### Property 3: Wrapper Structure Preservation

For any payslip content passed as children to PayslipWrapper, the wrapper SHALL render the children unchanged within the composed structure, preserving the existing payslip HTML and styling.

**Validates: Requirements 3.5, 3.6, 4.5, 6.2**

### Property 4: PDF Generation Capture

For any payslip with wrapper composition, calling generatePayslipPDF() SHALL capture all three components (letterhead, content, footer) from the #payslip-content element via html2canvas, resulting in a PDF with all sections visible.

**Validates: Requirements 4.2, 4.3**

### Property 5: Link Format Correctness

For any contact information in the footer, email links SHALL use the mailto: protocol format, WhatsApp links SHALL use the https://wa.me/ protocol format, and website links SHALL use the https: protocol format.

**Validates: Requirements 2.8, 2.9, 2.10, 6.1, 6.2, 6.3**

### Property 6: Print Styling Consistency

For any payslip rendered and printed (via browser print dialog or PDF), the letterhead, payslip content, and footer SHALL maintain consistent styling with visible borders and readable text in both screen and printed formats.

**Validates: Requirements 5.3, 5.4, 5.5, 5.6**

