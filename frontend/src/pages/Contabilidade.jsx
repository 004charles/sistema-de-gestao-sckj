import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';

const Contabilidade = () => {
  const [open, setOpen] = useState(false);
  const [ano, setAno] = useState('2024');
  const [mes, setMes] = useState('7');

  const [dados, setDados] = useState([
    { id: 1, conta: '24.4.1', descricao: 'IVA Liquidado', debito: '9.389.093,98', credito: '0,00', saldo: '9.389.093,98' },
    { id: 2, conta: '24.4.2', descricao: 'IVA Dedutível', debito: '0,00', credito: '5.934.722,98', saldo: '5.934.722,98' },
    { id: 3, conta: '24.4.3', descricao: 'IVA Apuramento', debito: '3.454.371,00', credito: '0,00', saldo: '3.454.371,00' },
    { id: 4, conta: '24.4.4', descricao: 'IVA a Pagar', debito: '0,00', credito: '3.454.371,00', saldo: '3.454.371,00' },
  ]);

  const meses = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <Typography variant="h4" sx={{ color: '#323130', fontWeight: 600 }}>
          Contabilidade
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            sx={{
              borderColor: '#0078D4',
              color: '#0078D4',
              textTransform: 'none',
              '&:hover': { borderColor: '#005A9E', backgroundColor: 'rgba(0, 120, 212, 0.04)' },
            }}
          >
            Importar CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{
              backgroundColor: '#0078D4',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#005A9E' },
            }}
          >
            Novo Registro
          </Button>
        </Box>
      </Box>

      <Paper sx={{ padding: 3, marginBottom: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              label="Ano"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              size="small"
            >
              <MenuItem value="2024">2024</MenuItem>
              <MenuItem value="2025">2025</MenuItem>
              <MenuItem value="2026">2026</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              label="Mês"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              size="small"
            >
              {meses.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              sx={{
                backgroundColor: '#0078D4',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#005A9E' },
              }}
            >
              Filtrar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ padding: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F3F2F1' }}>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Conta</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Descrição</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Débito (Kz)</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Crédito (Kz)</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Saldo (Kz)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.map((row) => (
                <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#FAF9F8' } }}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.conta}</TableCell>
                  <TableCell>{row.descricao}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.debito}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.credito}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{row.saldo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0078D4', color: '#FFFFFF' }}>
          Novo Registro Contábil
        </DialogTitle>
        <DialogContent sx={{ padding: 3 }}>
          <Grid container spacing={2} sx={{ marginTop: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth label="Conta" size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Descrição" size="small" />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Débito" size="small" type="number" />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Crédito" size="small" type="number" />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Saldo" size="small" type="number" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#605E5C', textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            sx={{
              backgroundColor: '#0078D4',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#005A9E' },
            }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Contabilidade;
