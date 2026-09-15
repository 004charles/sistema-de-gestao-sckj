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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const Reconciliacao = () => {
  const [open, setOpen] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [ano, setAno] = useState('2024');
  const [mes, setMes] = useState('7');

  const [reconciliacoes, setReconciliacoes] = useState([
    {
      id: 1,
      empresa: 'Empresa Alpha Lda',
      periodo: '07/2024',
      status: 'CONCILIADO',
      campos_ok: 5,
      divergencias: 0,
      data: '10/09/2024',
    },
    {
      id: 2,
      empresa: 'Beta Comércio',
      periodo: '07/2024',
      status: 'DIVERGENCIA',
      campos_ok: 3,
      divergencias: 2,
      data: '10/09/2024',
    },
    {
      id: 3,
      empresa: 'Gamma Serviços',
      periodo: '07/2024',
      status: 'CONCILIADO',
      campos_ok: 5,
      divergencias: 0,
      data: '09/09/2024',
    },
  ]);

  const [detalhes, setDetalhes] = useState([
    { campo: 'IVA Liquidado', contabilidade: '3.454.371,00', agt: '3.454.371,00', diferenca: '0,00', status: 'OK' },
    { campo: 'IVA Dedutível', contabilidade: '2.123.456,78', agt: '2.123.456,78', diferenca: '0,00', status: 'OK' },
    { campo: 'IVA Apuramento', contabilidade: '1.330.914,22', agt: '1.330.914,22', diferenca: '0,00', status: 'OK' },
    { campo: 'IVA a Pagar', contabilidade: '1.330.914,22', agt: '1.330.914,22', diferenca: '0,00', status: 'OK' },
    { campo: 'IVA a Recuperar', contabilidade: '0,00', agt: '0,00', diferenca: '0,00', status: 'OK' },
  ]);

  const empresas = [
    { id: 1, nome: 'Empresa Alpha Lda' },
    { id: 2, nome: 'Beta Comércio' },
    { id: 3, nome: 'Gamma Serviços' },
  ];

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

  const handleExecutar = async () => {
    if (!empresa) {
      toast.error('Selecione uma empresa');
      return;
    }
    setExecutando(true);
    setTimeout(() => {
      setExecutando(false);
      setOpen(false);
      toast.success('Reconciliação executada com sucesso!');
    }, 2000);
  };

  const getStatusChip = (status) => {
    if (status === 'CONCILIADO') {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Conciliado"
          size="small"
          sx={{
            backgroundColor: '#E6F4E6',
            color: '#107C10',
            '& .MuiChip-icon': { color: '#107C10' },
          }}
        />
      );
    }
    return (
      <Chip
        icon={<WarningIcon />}
        label="Divergência"
        size="small"
        sx={{
          backgroundColor: '#FDE7E9',
          color: '#D13438',
          '& .MuiChip-icon': { color: '#D13438' },
        }}
      />
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <Typography variant="h4" sx={{ color: '#323130', fontWeight: 600 }}>
          Reconciliação
        </Typography>
        <Button
          variant="contained"
          startIcon={<CompareArrowsIcon />}
          onClick={() => setOpen(true)}
          sx={{
            backgroundColor: '#0078D4',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#005A9E' },
          }}
        >
          Nova Reconciliação
        </Button>
      </Box>

      <Paper sx={{ padding: 3, marginBottom: 3 }}>
        <Typography variant="h6" sx={{ color: '#323130', fontWeight: 600, marginBottom: 2 }}>
          Reconciliações Anteriores
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F3F2F1' }}>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Empresa</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Período</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>Campos OK</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>Divergências</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Data</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reconciliacoes.map((row) => (
                <TableRow
                  key={row.id}
                  sx={{
                    '&:hover': { backgroundColor: '#FAF9F8' },
                    cursor: 'pointer',
                  }}
                >
                  <TableCell>{row.empresa}</TableCell>
                  <TableCell>{row.periodo}</TableCell>
                  <TableCell>{getStatusChip(row.status)}</TableCell>
                  <TableCell sx={{ textAlign: 'center', color: '#107C10', fontWeight: 600 }}>
                    {row.campos_ok}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', color: row.divergencias > 0 ? '#D13438' : '#605E5C', fontWeight: 600 }}>
                    {row.divergencias}
                  </TableCell>
                  <TableCell>{row.data}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ padding: 3 }}>
        <Typography variant="h6" sx={{ color: '#323130', fontWeight: 600, marginBottom: 2 }}>
          Detalhes da Reconciliação - Empresa Alpha Lda (07/2024)
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F3F2F1' }}>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Campo</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Contabilidade</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>AGT</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'right' }}>Diferença</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detalhes.map((row, index) => (
                <TableRow
                  key={index}
                  sx={{
                    '&:hover': { backgroundColor: '#FAF9F8' },
                    backgroundColor: row.status === 'DIVERGENCIA' ? '#FDE7E9' : 'transparent',
                  }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{row.campo}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.contabilidade}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.agt}</TableCell>
                  <TableCell
                    sx={{
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: row.status === 'DIVERGENCIA' ? '#D13438' : '#107C10',
                    }}
                  >
                    {row.diferenca}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      size="small"
                      sx={{
                        backgroundColor: row.status === 'OK' ? '#E6F4E6' : '#FDE7E9',
                        color: row.status === 'OK' ? '#107C10' : '#D13438',
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0078D4', color: '#FFFFFF' }}>
          Executar Reconciliação
        </DialogTitle>
        <DialogContent sx={{ padding: 3 }}>
          {executando && <LinearProgress sx={{ marginBottom: 2 }} />}
          <Grid container spacing={2} sx={{ marginTop: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                size="small"
                disabled={executando}
              >
                {empresas.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Ano"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                size="small"
                disabled={executando}
              >
                <MenuItem value="2024">2024</MenuItem>
                <MenuItem value="2025">2025</MenuItem>
                <MenuItem value="2026">2026</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Mês"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                size="small"
                disabled={executando}
              >
                {meses.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ padding: 2 }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{ color: '#605E5C', textTransform: 'none' }}
            disabled={executando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExecutar}
            variant="contained"
            disabled={executando}
            sx={{
              backgroundColor: '#0078D4',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#005A9E' },
            }}
          >
            {executando ? 'Executando...' : 'Executar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reconciliacao;
