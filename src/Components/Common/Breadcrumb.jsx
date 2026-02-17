import { Link, useLocation } from "react-router-dom";

function Breadcrumb() {
  const location = useLocation();

  const pathnames = location.pathname.split("/").filter((x) => x);

  return (
    <nav>
      <ul style={{ display: "flex", gap: "8px", listStyle: "none" }}>
        <li>
          <Link to="/">Inicio</Link>
          
        </li>
        {pathnames.map((name, index) => {

          const routeTo = "/" + pathnames.slice(0, index + 1).join("/");

          const isLast = index === pathnames.length - 1;
          return (
            <li key={name}>
              <span> / </span>
              {isLast ? (
                <span style={{ fontWeight: "bold" }}>{name}</span>
              ) : (
                <Link to={routeTo}>{name}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Breadcrumb;
