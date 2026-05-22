import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PropertyManagement } from "../components/PropertyForm";
import { PropertyList } from "../components/PropertyList";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

export function DashboardPage({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingProperty, setEditingProperty] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get("tab") || "create";

  async function loadProperties() {
    if (!tenantSlug) {
      setProperties([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await api.listProperties(tenantSlug);
      setProperties(result.properties ?? result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
  }, [tenantSlug]);

  async function handleCreateOrUpdateProperty(payload) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      const { imageFiles = [], ...propertyPayload } = payload;
      let targetPropertyId = null;

      if (editingProperty?.id) {
        const updated = await api.updateProperty(tenantSlug, editingProperty.id, propertyPayload);
        targetPropertyId = updated.id;
        setEditingProperty(null);
        setSearchParams({ tab: "list" });
      } else {
        const created = await api.createProperty(tenantSlug, propertyPayload);
        targetPropertyId = created.id;
      }

      if (targetPropertyId && imageFiles.length > 0) {
        for (const file of imageFiles) {
          const uploaded = await uploadToCloudinary(file);
          await api.addPropertyImage(tenantSlug, targetPropertyId, uploaded);
        }
      }

      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(propertyId) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      await api.deleteProperty(tenantSlug, propertyId);
      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(propertyId, nextStatus) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      await api.updateProperty(tenantSlug, propertyId, { status: nextStatus });
      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(property) {
    setEditingProperty(property);
    setSearchParams({ tab: "create" });
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      {loading ? <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Sincronizando dados...</p> : null}

      {activeSection === "create" ? (
        <PropertyManagement
          onSubmitProperty={handleCreateOrUpdateProperty}
          disabled={!tenantSlug || loading}
          initialData={editingProperty}
        />
      ) : (
        <PropertyList
          properties={properties}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onEdit={handleStartEdit}
          disabled={!tenantSlug || loading}
        />
      )}
    </>
  );
}