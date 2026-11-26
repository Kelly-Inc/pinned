/** Where the client should POST the file for a registered upload. */
export function uploadRegistration(id, origin) {
  return {
    upload_id: id,
    upload_url: `${origin}/upload/${id}`,
    upload_parameters: { key: `uploads/${id}` },
  };
}
