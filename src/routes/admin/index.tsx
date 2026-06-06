import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAdminContext } from "../admin";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ShieldAlert, Loader2, Plus, Trash2, CheckCircle2, UploadCloud, X, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/chezjoe/ThemeToggle";
import { tawookImg, IMAGE_MAP } from "@/components/chezjoe/Sections";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardIndex,
});

interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag: string;
  imageKey: string;
  isSoldOut: boolean;
}

function AdminDashboardIndex() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [authPassword, setAuthPassword] = useState("");
  const [localMenu, setLocalMenu] = useState<MenuItem[]>([]);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // Add Item Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    desc: "",
    price: 10.00,
    tag: "Specialty",
    imageType: "preset" as "preset" | "custom",
    imageKey: "plated",
    customImage: "",
    isSoldOut: false,
  });

  // Retrieve shared menu state from Layout Context
  const { menuData, refetchMenu, isLoadingMenu, loadError } = useAdminContext();

  // Sync loaded data to local state
  useEffect(() => {
    if (menuData) {
      setLocalMenu(menuData);
    }
  }, [menuData]);

  // Load password from session
  useEffect(() => {
    const isAuth = sessionStorage.getItem("chezjoe_admin_auth") === "true";
    const savedPass = sessionStorage.getItem("chezjoe_admin_pass") || "";
    if (isAuth && savedPass) {
      setAuthPassword(savedPass);
    } else {
      // Safety fallback: if session auth is somehow lost, force reload layout
      window.location.reload();
    }
  }, []);

  // Mutation to save changes
  const saveMutation = useMutation({
    mutationFn: async (updatedMenu: MenuItem[]) => {
      const res = await fetch("/api/menu/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authPassword,
        },
        body: JSON.stringify(updatedMenu),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update menu");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMenu();
      showStatus("success", "Changes saved successfully!");
    },
    onError: (err: any) => {
      showStatus("error", err.message || "Failed to save changes.");
    }
  });

  const showStatus = (type: string, text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: "", text: "" }), 4000);
  };

  const handleFieldChange = (index: number, field: keyof MenuItem, value: any) => {
    const updated = [...localMenu];
    updated[index] = { ...updated[index], [field]: value };
    setLocalMenu(updated);
  };

  const handleOpenAddModal = () => {
    setNewItemForm({
      name: "",
      desc: "",
      price: 10.00,
      tag: "Specialty",
      imageType: "preset",
      imageKey: "plated",
      customImage: "",
      isSoldOut: false,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.name.trim()) {
      alert("Please enter a name for the menu item.");
      return;
    }
    if (newItemForm.price < 0) {
      alert("Price cannot be negative.");
      return;
    }

    const imageKey = newItemForm.imageType === "custom" ? newItemForm.customImage : newItemForm.imageKey;
    if (newItemForm.imageType === "custom" && !newItemForm.customImage) {
      alert("Please upload an image or select a preset instead.");
      return;
    }

    const newItem: MenuItem = {
      id: "item_" + Date.now(),
      name: newItemForm.name.trim(),
      desc: newItemForm.desc.trim() || "Delicious new menu item.",
      price: newItemForm.price,
      tag: newItemForm.tag.trim() || "Specialty",
      imageKey: imageKey || "plated",
      isSoldOut: newItemForm.isSoldOut,
    };

    setLocalMenu([...localMenu, newItem]);
    setIsAddModalOpen(false);
    showStatus("success", `"${newItem.name}" added to list (unsaved).`);
  };

  const handleDeleteItem = (index: number) => {
    if (confirm("Are you sure you want to delete this menu item?")) {
      const updated = localMenu.filter((_, i) => i !== index);
      setLocalMenu(updated);
    }
  };

  const handleSaveChanges = () => {
    saveMutation.mutate(localMenu);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("chezjoe_admin_auth");
    sessionStorage.removeItem("chezjoe_admin_pass");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 admin-page">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 pb-6 border-b border-border">
          <div className="flex justify-between items-center w-full">
            <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-2">
              <ArrowLeft className="w-4 h-4" /> Home Site
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-3.5 py-2 border border-border hover:border-red-500/40 hover:text-red-500 rounded-xl text-xs uppercase tracking-[0.2em] transition-all cursor-pointer font-medium h-11"
              >
                Log Out
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-medium">Menu Manager</h1>
              <p className="text-xs text-gold uppercase tracking-[0.25em] mt-1">Live Database Editor</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Link
                to="/admin/ai"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gold/40 text-gold hover:border-gold hover:bg-gold/5 text-xs uppercase tracking-[0.2em] font-semibold transition-all h-11"
              >
                <Sparkles className="w-4 h-4" /> Go to AI Voice Assistant
              </Link>
              <button
                onClick={handleSaveChanges}
                disabled={saveMutation.isPending}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 h-11 shadow-lg shadow-gold/10"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMsg.text && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border animate-fade-in ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            )}
            <p className="text-sm font-medium">{statusMsg.text}</p>
          </div>
        )}

        {/* Loading / Error / Content Grid */}
        {isLoadingMenu ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4 bg-surface border border-border rounded-2xl">
            <Loader2 className="w-10 h-10 animate-spin text-gold" />
            <p className="text-xs uppercase tracking-[0.3em]">Loading Menu Database...</p>
          </div>
        ) : loadError ? (
          <div className="py-20 text-center flex flex-col items-center justify-center text-red-400 gap-4 bg-surface border border-border rounded-2xl">
            <ShieldAlert className="w-10 h-10" />
            <p className="font-medium">Failed to retrieve menu.</p>
            <button
              onClick={() => refetchMenu()}
              className="px-5 py-2.5 border border-red-500/20 bg-red-500/10 rounded-xl text-xs uppercase tracking-[0.2em] hover:bg-red-500/20 h-11"
            >
              Retry Request
            </button>
          </div>
        ) : (
          /* Mobile-First Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {localMenu.map((item, idx) => (
              <div
                key={item.id}
                className="bg-surface border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col gap-4 relative"
              >
                {/* Header Controls (Tag, Delete, Out of Stock) */}
                <div className="flex justify-between items-center gap-2">
                  <input
                    type="text"
                    value={item.tag}
                    onChange={(e) => handleFieldChange(idx, "tag", e.target.value)}
                    placeholder="Category Tag"
                    className="bg-background border border-border rounded-lg text-xs py-1.5 px-3 outline-none focus:border-gold text-foreground font-semibold uppercase tracking-wider max-w-[120px] h-9"
                  />
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange(idx, "isSoldOut", !item.isSoldOut)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        item.isSoldOut ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                          item.isSoldOut ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(idx)}
                      className="p-2 border border-border rounded-xl text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-all cursor-pointer h-10 w-10 flex items-center justify-center"
                      aria-label="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex gap-4">
                  {/* Left Column: Image Selector */}
                  <div className="flex flex-col gap-2 shrink-0 items-center">
                    <img
                      src={item.imageKey.startsWith("data:") ? item.imageKey : (IMAGE_MAP[item.imageKey] || tawookImg)}
                      alt="Thumbnail"
                      className="w-20 h-20 object-cover rounded-xl border border-border"
                    />
                    <select
                      value={item.imageKey.startsWith("data:") ? "custom" : item.imageKey}
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          handleFieldChange(idx, "imageKey", e.target.value);
                        }
                      }}
                      className="bg-background border border-border rounded-lg text-[10px] py-1 px-1.5 outline-none focus:border-gold text-foreground w-20 font-semibold cursor-pointer h-8"
                    >
                      <option value="tawook">Tawouk</option>
                      <option value="burger">Burger</option>
                      <option value="francisco">Francisco</option>
                      <option value="plated">Plated</option>
                      <option value="kitchen">Grill</option>
                      <option value="sandwish">Wrap</option>
                      <option value="storefront1">Store 1</option>
                      <option value="storefront3">Store 3</option>
                      {item.imageKey.startsWith("data:") && (
                        <option value="custom">Custom</option>
                      )}
                    </select>
                    
                    <label className="px-2 py-1 bg-surface border border-border text-[9px] uppercase tracking-wider rounded-lg hover:border-gold cursor-pointer text-muted-foreground hover:text-gold text-center w-20 transition-colors font-bold h-7 flex items-center justify-center">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleFieldChange(idx, "imageKey", reader.result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Right Column: Name, Price, Description fields */}
                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    <div>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                        placeholder="Item Name"
                        className="w-full bg-background border border-border rounded-xl text-sm py-2 px-3 outline-none focus:border-gold text-foreground font-semibold h-11"
                        required
                      />
                    </div>
                    
                    <div>
                      <div className="relative flex items-center bg-background border border-border rounded-xl focus-within:border-gold pr-3 h-11">
                        <span className="text-muted-foreground text-sm pl-3 font-semibold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleFieldChange(idx, "price", parseFloat(e.target.value) || 0)}
                          className="bg-transparent outline-none flex-1 text-sm pl-1 font-mono text-foreground"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description Textarea spanning card bottom */}
                <div>
                  <textarea
                    value={item.desc}
                    onChange={(e) => handleFieldChange(idx, "desc", e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-xl text-xs py-2.5 px-3 outline-none focus:border-gold text-foreground resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer controls */}
        {!isLoadingMenu && !loadError && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 border border-dashed border-gold/40 text-gold hover:border-gold hover:bg-gold/5 rounded-xl text-xs uppercase tracking-[0.2em] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
            >
              <Plus className="w-4 h-4" /> Add New Item
            </button>

            <button
              onClick={handleSaveChanges}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto px-10 py-3 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 h-12 shadow-lg shadow-gold/15"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Add New Item Modal (Clean & Touch-friendly) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="absolute top-0 inset-x-0 h-1 bg-gold" />
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-medium text-foreground">Add New Menu Item</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Define item details and image source</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-xl border border-transparent hover:border-border transition-colors cursor-pointer h-10 w-10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateItem} className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    placeholder="e.g. Garlic Halloumi Deluxe"
                    className="w-full bg-background border border-border rounded-xl text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                      Price ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newItemForm.price}
                      onChange={(e) => setNewItemForm({ ...newItemForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-background border border-border rounded-xl text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground font-mono h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                      Category / Tag
                    </label>
                    <input
                      type="text"
                      value={newItemForm.tag}
                      onChange={(e) => setNewItemForm({ ...newItemForm, tag: e.target.value })}
                      placeholder="e.g. Specialty"
                      className="w-full bg-background border border-border rounded-xl text-sm py-2.5 px-3 outline-none focus:border-gold text-foreground h-11"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                    Description
                  </label>
                  <textarea
                    value={newItemForm.desc}
                    onChange={(e) => setNewItemForm({ ...newItemForm, desc: e.target.value })}
                    placeholder="Describe the dish ingredients and style..."
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl text-xs py-2.5 px-3 outline-none focus:border-gold text-foreground resize-none"
                  />
                </div>

                {/* Image Selection Tabs */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                    Image Source
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-background p-1 border border-border rounded-xl h-11">
                    <button
                      type="button"
                      onClick={() => setNewItemForm({ ...newItemForm, imageType: "preset" })}
                      className={`text-xs uppercase tracking-wider rounded-lg transition-all font-semibold ${
                        newItemForm.imageType === "preset"
                          ? "bg-gold text-[#0A0A0C]"
                          : "text-muted-foreground hover:text-gold/80"
                      }`}
                    >
                      Preset Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemForm({ ...newItemForm, imageType: "custom" })}
                      className={`text-xs uppercase tracking-wider rounded-lg transition-all font-semibold ${
                        newItemForm.imageType === "custom"
                          ? "bg-gold text-[#0A0A0C]"
                          : "text-muted-foreground hover:text-gold/80"
                      }`}
                    >
                      Custom Upload
                    </button>
                  </div>
                </div>

                {newItemForm.imageType === "preset" ? (
                  <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {Object.keys(IMAGE_MAP).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewItemForm({ ...newItemForm, imageKey: key })}
                        className={`p-1 border rounded-lg overflow-hidden transition-all bg-background text-left relative flex flex-col items-center gap-1 ${
                          newItemForm.imageKey === key
                            ? "border-gold ring-1 ring-gold"
                            : "border-border hover:border-gold/50"
                        }`}
                      >
                        <img
                          src={IMAGE_MAP[key]}
                          alt={key}
                          className="w-full h-8 object-cover rounded"
                        />
                        <span className="text-[8px] uppercase font-bold text-center truncate w-full text-foreground/80">
                          {key}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    {newItemForm.customImage ? (
                      <div className="relative border border-border rounded-xl overflow-hidden bg-background flex items-center justify-center p-2 group max-h-[120px]">
                        <img
                          src={newItemForm.customImage}
                          alt="Upload Preview"
                          className="max-h-[100px] object-contain rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setNewItemForm({ ...newItemForm, customImage: "" })}
                          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-border hover:border-gold/55 rounded-xl bg-background hover:bg-gold/5 p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[100px]">
                        <UploadCloud className="w-6 h-6 text-muted-foreground mb-1" />
                        <span className="text-xs font-semibold text-foreground">Click to upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                alert("Image is too large. Please upload an image under 2MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewItemForm({ ...newItemForm, customImage: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-background rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gold text-[#0A0A0C] text-xs uppercase tracking-[0.2em] font-semibold rounded-lg hover:scale-[1.02] transition-all cursor-pointer h-11"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
