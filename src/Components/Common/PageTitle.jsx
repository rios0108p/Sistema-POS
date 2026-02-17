import React from "react";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router-dom";

const PageTitle = ({ heading, text, path = "/", linkText }) => {
  return (
    <div className="my-6">
      {/* Título principal */}
      <h2 className="text-2xl font-semibold text-slate-800">{heading}</h2>

      {/* Texto descriptivo + enlace */}

      
      <div className="flex items-center gap-3">
        <p className="text-slate-600">{text}</p>
        {linkText && (
          <Link
            to={path}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm transition"
          >
            {linkText}
            <ArrowRightIcon size={14} />
          </Link>
        )}
      </div>
    </div>
  );
};

export default PageTitle;
