# 📘 Salary Form - User Guide

## How to Use the Fully Editable Salary Form

---

## 🎯 Quick Start

1. Go to **Salaries** page
2. Click **Salary Structure Setup** tab
3. Click **Setup** button for any employee
4. Fill the form and save

---

## 📝 Form Sections

### Section 1: EARNINGS (Left Column)

#### **Fixed Gross Salary**
- Enter the total monthly salary (e.g., ₹10,000)
- This is the base amount for all calculations

#### **Basic Salary**
- **Percentage Field** (small box on right): Default 50%
- **Amount Field** (main input): Auto-calculates OR enter manually
- **How it works:**
  - Leave amount empty → Auto: 50% of ₹10,000 = ₹5,000
  - Change % to 60% → Auto: 60% of ₹10,000 = ₹6,000
  - Enter amount ₹5,500 → Manual override (ignores %)

#### **HRA Amount**
- **Percentage Field**: Default 40% (of Basic)
- **Amount Field**: Auto-calculates OR enter manually
- **How it works:**
  - Leave empty → Auto: 40% of Basic (₹5,000) = ₹2,000
  - Change % to 50% → Auto: 50% of Basic = ₹2,500
  - Enter ₹2,200 → Manual override

#### **Other Allowance**
- **Percentage Field**: Default 30% (of Gross)
- **Amount Field**: Auto-calculates OR enter manually
- **How it works:**
  - Leave empty → Auto: 30% of Gross (₹10,000) = ₹3,000
  - Change % to 25% → Auto: 25% of Gross = ₹2,500
  - Enter ₹2,800 → Manual override

#### **Variable Earnings** (All Optional)
- Lesson Plan Incentive: ₹1,000
- English Training Incentive: ₹500
- Digital Training Incentive: ₹500
- Travel Allowance: ₹0
- Special Bonus: ₹0
- Other Incentive: ₹0

---

### Section 2: DEDUCTIONS (Middle Column)

#### **EPF Deduction**
- **Toggle**: ON/OFF
- **Percentage Field**: Default 12%
- **Auto-calculated**: 12% of Basic Salary
- **Example**: 12% of ₹5,000 = ₹600

#### **ESIC Deduction**
- **Toggle**: ON/OFF
- **Percentage Field**: Default 0.75%
- **Auto-calculated**: 0.75% of Total Gross Earnings
- **Example**: 0.75% of ₹12,000 = ₹90

#### **Manual Deduction**
- Enter any amount (e.g., loan deduction)
- Add remark (optional)

#### **Other Deductions**
- TDS Deduction: Enter amount
- Professional Tax: Enter amount
- Other Deductions: Enter amount

---

### Section 3: LIVE CALCULATION (Right Column)

#### **Card A: Fixed Salary Structure** (Green)
Shows breakdown of fixed salary:
- Fixed Gross: ₹10,000
- Basic (50%): ₹5,000
- HRA (40% of Basic): ₹2,000
- Other (30%): ₹3,000

#### **Card B: Total Earnings** (Blue)
Shows total earnings:
- Fixed Gross: ₹10,000
- Variable Earnings: ₹2,000
- **Total Gross: ₹12,000**

#### **Card C: Employee Deductions** (Red)
Shows all deductions:
- EPF Employee: ₹600
- ESIC Employee: ₹90
- **Total Deductions: ₹690**

#### **Card D: Net Payable** (Purple)
Shows take-home salary:
- **Net Payable: ₹11,310**

#### **Card E: Employer Contributions** (Orange)
Shows employer's share:
- EPF Employer (12%): ₹600
- ESIC Employer (3.25%): ₹390
- **Total Employer Benefit: ₹990**

#### **Card F: Total CTC** (Gray)
Shows complete cost:
- **Total CTC: ₹12,990**
- (Gross Earnings + Employer Benefits)

---

## 💡 Tips & Tricks

### Tip 1: Use Percentages for Standard Cases
```
Fixed Gross: ₹10,000
Basic %: 50 → Auto: ₹5,000
HRA %: 40 → Auto: ₹2,000
Other %: 30 → Auto: ₹3,000
```

### Tip 2: Use Manual Override for Special Cases
```
Fixed Gross: ₹10,000
Basic: Enter ₹5,500 (manual)
HRA: Enter ₹2,200 (manual)
Other: Enter ₹2,300 (manual)
```

### Tip 3: Mix Both Methods
```
Fixed Gross: ₹10,000
Basic %: 50 → Auto: ₹5,000 ✅
HRA: Enter ₹2,500 (manual) ✅
Other %: 25 → Auto: ₹2,500 ✅
```

### Tip 4: Watch Live Calculations
- All cards update in real-time
- Change any field → See instant results
- Verify calculations before saving

---

## 🎯 Common Scenarios

### Scenario 1: Standard Employee (₹10,000)
```
Fixed Gross: ₹10,000
Basic %: 50 → ₹5,000
HRA %: 40 → ₹2,000
Other %: 30 → ₹3,000
EPF: ON (12%)
ESIC: ON (0.75%)
Variable: ₹0

Result:
- Total Gross: ₹10,000
- Deductions: ₹450
- Net Payable: ₹9,550
- Total CTC: ₹10,775
```

### Scenario 2: Employee with Incentives (₹10,000 + ₹2,000)
```
Fixed Gross: ₹10,000
Basic %: 50 → ₹5,000
HRA %: 40 → ₹2,000
Other %: 30 → ₹3,000
EPF: ON (12%)
ESIC: ON (0.75%)
Variable:
  - Lesson Plan: ₹1,000
  - English Training: ₹500
  - Digital Training: ₹500

Result:
- Total Gross: ₹12,000
- Deductions: ₹690
- Net Payable: ₹11,310
- Total CTC: ₹12,990
```

### Scenario 3: Custom Salary Structure
```
Fixed Gross: ₹15,000
Basic: ₹8,000 (manual)
HRA: ₹3,500 (manual)
Other: ₹3,500 (manual)
EPF: ON (12%)
ESIC: OFF
Variable: ₹0

Result:
- Total Gross: ₹15,000
- Deductions: ₹960 (EPF only)
- Net Payable: ₹14,040
- Total CTC: ₹15,960
```

---

## ⚠️ Important Notes

1. **Fixed Gross is Required**
   - You must enter Fixed Gross Salary first
   - All other calculations depend on this

2. **Percentages vs Manual**
   - If you enter manual amount, percentage is ignored
   - Clear manual amount to use percentage again

3. **EPF Calculation**
   - EPF is always calculated on Basic Salary only
   - Not on total gross or other components

4. **ESIC Calculation**
   - ESIC is calculated on Total Gross Earnings
   - Includes fixed + variable earnings

5. **Employer Contributions**
   - Automatically calculated
   - Cannot be edited manually
   - EPF Employer = 12% of Basic
   - ESIC Employer = 3.25% of Gross

6. **Total CTC**
   - Includes employee earnings + employer contributions
   - This is the actual cost to company

---

## 🔍 Verification Checklist

Before saving, verify:
- ✅ Fixed Gross Salary entered correctly
- ✅ Basic + HRA + Other = Fixed Gross (if using %)
- ✅ Variable earnings entered (if applicable)
- ✅ EPF/ESIC toggles set correctly
- ✅ Manual deductions entered (if any)
- ✅ Bank account details filled
- ✅ PF UAN and ESIC IP numbers (if applicable)
- ✅ Effective date selected
- ✅ Live calculations look correct

---

## 🆘 Troubleshooting

### Problem: Calculations not updating
**Solution:** Check if you entered manual amounts. Clear them to use auto-calculation.

### Problem: EPF amount seems wrong
**Solution:** EPF is calculated on Basic Salary only, not total gross.

### Problem: Can't save form
**Solution:** Make sure Fixed Gross Salary and Effective Date are filled (required fields).

### Problem: Want to reset to auto-calculation
**Solution:** Clear the manual amount field, it will auto-calculate based on percentage.

---

## 📞 Need Help?

If you have questions:
1. Check the live calculation cards
2. Verify your percentages
3. Try clearing manual overrides
4. Contact admin for assistance

---

**Last Updated:** May 15, 2026  
**Version:** 2.0 (Fully Editable)
