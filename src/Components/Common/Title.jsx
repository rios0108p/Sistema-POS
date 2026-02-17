import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const Title = ({
  title,
  visibleButton = true,
  href = "/",
  id,
  variant = "default",
}) => {
  const isHome = variant === "home";

  if (isHome) {
    return (
      <div className="flex items-center justify-between w-full">
        {/* Título izquierda */}
        <h2
          id={id}
          className="font-figtree text-[14px] font-bold text-slate-800"
        >
          {title}
        </h2>

        {/* CTA derecha (kemik style) */}
        {visibleButton && (
          <Link
            to={href}
            className="
              flex items-center gap-0.5
              bg-white
              rounded-full
              px-3 py-1.5
              text-[13px]
              font-semibold
              text-slate-700
              no-underline
            "
            aria-label={`Ver todo sobre ${title}`}
          >
            Ver todo
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
    );
  }

  

  /* Variante default */
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-semibold text-slate-800">
        {title}
      </h2>
    </div>
  );
};

export default Title;
