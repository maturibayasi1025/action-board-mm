import Link from "next/link";
import { FOOTER_CONFIG } from "./footer";

export function CopyrightSection() {
  return (
    <div className="bg-white py-8">
      <div className="px-4 md:container md:mx-auto">
        <div className="text-center">
          <div className="flex justify-center items-center gap-2 text-sm">
            <Link
              href="https://maisonmarc.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-700 transition-colors duration-200 text-teal-600"
            >
              運営組織
            </Link>
            <span>|</span>
            <Link
              href="/"
              className="hover:text-teal-700 transition-colors duration-200 text-teal-600"
            >
              利用規約
            </Link>
            <span>|</span>
            <Link
              href="/"
              className="hover:text-teal-700 transition-colors duration-200 text-teal-600"
            >
              プライバシーポリシー
            </Link>
            <span>|</span>
            <Link
              href="https://docs.google.com/spreadsheets/d/17FPjP5pC1YhbwvfBH1X19bzfDPLhrwKqhC6ZZyzVC6g/edit?usp=sharing"
              className="hover:text-teal-700 transition-colors duration-200 text-teal-600"
              target="_blank"
              rel="noopener noreferrer"
            >
              ご意見箱
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-4">
          © 2025 MAISON MARC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
