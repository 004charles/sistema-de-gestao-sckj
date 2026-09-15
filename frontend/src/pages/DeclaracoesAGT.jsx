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

const DeclaracoesAGT = () => {
  const [open, setOpen] = useState(false);
  const [ano, setAno] = useState('2024');
  const [mes, setMes] = useState('7');

  const [dados, setDados] = useState([
    {
      id: 1,
      empresa: 'Empresa Alpha Lda',
      periodo: 'Julho/2024',
      liquidado: '3.454.371,00',
      dedutivel: '2.123.456,78',
      apurado: '1.330.914,22',
      pagar: '1.330.914,22',
      recuperar: '0,00',
    },
    {
      id: 2,
      empresa: 'Beta Comércio',
      periodo: 'Julho/2024',
      liquidado: '1.234.567,89',
      dedutivel: '876.543,21',
      apurado: '358.024,68',
      pagar: '358.024,68',
      recuperar: '0,00',
    },
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
          Declarações AGT
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
            Importar PDF
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
            Nova Declaração
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
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Empresa</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Período</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>IVA Liquidado</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>IVA Dedutível</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Apurado</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>A Pagar</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>A Recuperar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.map((row) => (
                <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#FAF9F8' } }}>
                  <TableCell>{row.empresa}</TableCell>
                  <TableCell>{row.periodo}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.liquidado}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.dedutivel}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.apurado}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.pagar}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{row.recuperar}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0078D4', color: '#FFFFFF' }}>
          Nova Declaração AGT
        </DialogTitle>
        <DialogContent sx={{ padding: 3 }}>
          <Grid container spacing={2} sx={{ marginTop: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth select label="Empresa" size="small">
                <MenuItem value="1">Empresa Alpha Lda</MenuItem>
                <MenuItem value="2">Beta Comércio</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Ano" size="small" defaultValue="2024">
                <MenuItem value="2024">2024</MenuItem>
                <MenuItem value="2025">2025</MenuItem>
                <MenuItem value="2026">2026</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Mês" size="small" defaultValue="7">
                {meses.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="IVA Liquidado" size="small" type="number" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="IVA Dedutível" size="small" type="number" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="IVA Apurado" size="small" type="number" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="IVA a Pagar" size="small" type="number" />
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

export default DeclaracoesAGT;
