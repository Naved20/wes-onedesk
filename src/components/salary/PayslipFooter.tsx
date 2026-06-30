import { Mail, MessageCircle } from "lucide-react";

export function PayslipFooter(): JSX.Element {
  return (
    <div className="w-full border-t-2 border-gray-300 print:border-black pt-4 mt-8 text-sm">
      <div className="grid grid-cols-2 gap-6">
        {/* Left column: organization details */}
        <div className="text-gray-800">
          <p className="font-bold mb-2">WAZIR EDUCATION SOCIETY</p>
          <p className="text-xs text-gray-600 leading-tight mb-2">
            145, Ward No 15, Micheal Chowk, Dhanpuri, Shahdol, MP 48411
          </p>
          <a
            href="https://www.wazirzeducationsociety.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-xs"
          >
            www.wazirzeducationsociety.com
          </a>
        </div>

        {/* Right column: contact information */}
        <div className="text-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-500 shrink-0" />
            <a
              href="mailto:info@wazirzeducationsociety.com"
              className="text-blue-600 hover:underline text-xs"
            >
              info@wazirzeducationsociety.com
            </a>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-gray-500 shrink-0" />
            <a
              href="https://wa.me/917999780490"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              +917999780490
            </a>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-gray-500 shrink-0" />
            <a
              href="https://wa.me/917089245919"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              +917089245919
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
