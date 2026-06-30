import wesLogo from "@/assets/wes-logo.jpg";

export function PayslipLetterhead(): JSX.Element {
  return (
    <div className="w-full flex items-center gap-6 py-6 border-b-2 border-gray-300 print:border-black">
      {/* Logo — left */}
      <div>
      <img
        src={wesLogo}
        alt="WES Foundation Logo"
        className="h-20 w-20 object-contain shrink-0"
        onError={(e) => {
          console.warn("Logo failed to load");
          e.currentTarget.style.display = "none";
        }}
      />
      </div>
      {/* Text — left-aligned */}
      <div className="flex-1 pl-50 text-right">
        <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">WAZIR EDUCATION SOCIETY</h2>
        <p className="text-sm italic text-gray-600 mb-1">
          Change is the end result of all true learning
        </p>
        <p className="text-xs text-gray-500 leading-tight">
          Registration No. 05/23/01/16310/22&nbsp;&nbsp;PAN: AABAW20263R&nbsp;&nbsp;NGO Darpan: MP/2022/0321976
        </p>
        </div>
        
      </div>
      <div className="h-20 w-20 object-contain shrink-0" >

      </div>
    </div>
  );
}
