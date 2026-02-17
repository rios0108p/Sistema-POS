import toast from "react-hot-toast";

const baseStyle = {
  borderRadius: "8px",
  fontSize: "14px",
  padding: "12px 16px",
};

export const useNotify = () => {
  return {
    success: (message) =>
      toast.success(message, {
        style: {
          ...baseStyle,
          background: "#ECFDF5",
          color: "#065F46",
        },
        iconTheme: {
          primary: "#10B981",
          secondary: "#ECFDF5",
        },
      }),

    warning: (message) =>
      toast(message, {
        icon: "⚠️",
        style: {
          ...baseStyle,
          background: "#FFFBEB",
          color: "#92400E",
        },
      }),

    error: (message) =>
      toast.error(message, {
        style: {
          ...baseStyle,
          background: "#FEF2F2",
          color: "#991B1B",
        },
        iconTheme: {
          primary: "#EF4444",
          secondary: "#FEF2F2",
        },
      }),
  };
};
