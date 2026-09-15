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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const Empresas = () => {
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState([
    { id: 1, nome: 'Empresa Alpha Lda', nif: '5417689234', regime: 'Geral', ativo: true },
    { id: 2, nome: 'Beta Comércio', nif: '5417689235', regime: 'Geral', ativo: true },
    { id: 3, nome: 'Gamma Serviços', nif: '5417689236', regime: 'Simplificado', ativo: true },
    { id: 4, nome: 'Delta Indústria', nif: '5417689237', regime: 'Geral', ativo: false },
  ]);

  const [formData, setFormData] = useState({
    nome: '',
    nif: '',
    regime_iva: 'Geral',
    endereco: '',
    telefone: '',
    email: '',
  });

  const regimes = ['Geral', 'Simplificado', 'Isento'];

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ nome: '', nif: '', regime_iva: 'Geral', endereco: '', telefone: '', email: '' });
  };

  const handleSubmit = () => {
    const newEmpresa = {
      id: empresas.length + 1,
      ...formData,
      ativo: true,
    };
    setEmpresas([...empresas, newEmpresa]);
    handleClose();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <Typography variant="h4" sx={{ color: '#323130', fontWeight: 600 }}>
          Empresas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleClickOpen}
          sx={{
            backgroundColor: '#0078D4',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#005A9E' },
          }}
        >
          Nova Empresa
        </Button>
      </Box>

      <Paper sx={{ padding: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, marginBottom: 3 }}>
          <TextField
            size="small"
            placeholder="Buscar empresa..."
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: '#A19F9D', marginRight: 1 }} />,
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F3F2F1' }}>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Nome</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>NIF</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Regime IVA</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {empresas.map((empresa) => (
                <TableRow key={empresa.id} sx={{ '&:hover': { backgroundColor: '#FAF9F8' } }}>
                  <TableCell>{empresa.nome}</TableCell>
                  <TableCell>{empresa.nif}</TableCell>
                  <TableCell>{empresa.regime}</TableCell>
                  <TableCell>
                    <Chip
                      label={empresa.ativo ? 'Ativo' : 'Inativo'}
                      size="small"
                      sx={{
                        backgroundColor: empresa.ativo ? '#E6F4E6' : '#F3F2F1',
                        color: empresa.ativo ? '#107C10' : '#605E5C',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" sx={{ color: '#0078D4' }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#D13438' }}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0078D4', color: '#FFFFFF' }}>
          Nova Empresa
        </DialogTitle>
        <DialogContent sx={{ padding: 3 }}>
          <Grid container spacing={2} sx={{ marginTop: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome da Empresa"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="NIF"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Regime IVA"
                value={formData.regime_iva}
                onChange={(e) => setFormData({ ...formData, regime_iva: e.target.value })}
                size="small"
              >
                {regimes.map((regime) => (
                  <MenuItem key={regime} value={regime}>
                    {regime}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Endereço"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                size="small"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={handleClose} sx={{ color: '#605E5C', textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
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

export default Empresas;
