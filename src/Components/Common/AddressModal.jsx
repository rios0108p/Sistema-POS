import { XIcon, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

const AddressModal = ({ setShowAddressModal, onSaveAddress }) => {

  const [address, setAddress] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });

  const handleChange = (e) => {
    setAddress({
      ...address,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!address.name || !address.address || !address.phone) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    onSaveAddress(address); // ← ESTO ES LO IMPORTANTE
    toast.success("Dirección agregada correctamente");
    setShowAddressModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="relative bg-white w-full max-w-md mx-4 p-6 rounded-xl shadow-lg space-y-4"
      >
        <button
          type="button"
          onClick={() => setShowAddressModal(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
        >
          <XIcon size={22} />
        </button>

        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <MapPin size={20} />
          Dirección de entrega
        </h2>

        <input
          type="text"
          name="name"
          placeholder="Nombre completo *"
          value={address.name}
          onChange={handleChange}
          className="w-full p-3 border border-slate-300 rounded-lg"
          required
        />

        <textarea
          name="address"
          placeholder="Dirección completa *"
          value={address.address}
          onChange={handleChange}
          rows={3}
          className="w-full p-3 border border-slate-300 rounded-lg resize-none"
          required
        />

        <input
          type="tel"
          name="phone"
          placeholder="Teléfono *"
          value={address.phone}
          onChange={handleChange}
          className="w-full p-3 border border-slate-300 rounded-lg"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Correo (opcional)"
          value={address.email}
          onChange={handleChange}
          className="w-full p-3 border border-slate-300 rounded-lg"
        />

        <button
          type="submit"
          className="w-full bg-slate-800 text-white py-3 rounded-lg"
        >
          Guardar dirección
        </button>
      </form>
    </div>
  );
};

export default AddressModal;
