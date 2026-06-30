import React from "react";
import { PayslipLetterhead } from "./PayslipLetterhead";
import { PayslipFooter } from "./PayslipFooter";

interface PayslipWrapperProps {
  children: React.ReactNode;
}

export function PayslipWrapper({ children }: PayslipWrapperProps): JSX.Element {
  return (
    <div>
      <PayslipLetterhead />
      {children}
      <PayslipFooter />
    </div>
  );
}
