import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    background-color: #FFFFFF;
    color: #0F172A;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: #FFFFFF;
  }

  ::-webkit-scrollbar-thumb {
    background: #CBD5E1;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #94A3B8;
  }

  a {
    color: #003D99;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`;

export default GlobalStyle;
