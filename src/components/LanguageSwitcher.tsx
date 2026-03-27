import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  // Ensure we get the base language code (e.g. 'en' from 'en-US')
  const getBaseLang = (lang: string) => lang ? lang.split('-')[0] : 'en';
  
  const [currentLang, setCurrentLang] = useState(
    getBaseLang(i18n.language || window.localStorage.i18nextLng || 'en')
  );

  useEffect(() => {
    setCurrentLang(getBaseLang(i18n.language));
  }, [i18n.language]);

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  return (
    <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
      <Globe className="w-4 h-4 text-slate-500" />
      <select 
        value={currentLang}
        onChange={changeLanguage}
        className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
      >
        <option value="en">EN</option>
        <option value="ta">தமிழ்</option>
        <option value="hi">हिंदी</option>
      </select>
    </div>
  );
}
