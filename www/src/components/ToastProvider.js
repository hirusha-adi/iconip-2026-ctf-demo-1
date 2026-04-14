'use client';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={2500}
      hideProgressBar
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      draggable
      theme="dark"
      toastClassName="!border !border-[#2a2a3a] !bg-[#12121a] !text-[#e0e0e0]"
    />
  );
}
